import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { invitationPreviewSchema, invitationSchema, memberSchema, membershipSchema } from '@/api/schemas/members'

/**
 * Contract test for members and invitations (screen 15). It creates a throwaway project owned by the demo account and
 * one throwaway researcher (taken through the application workflow, as in account-write.test.ts; the account stays as a
 * declined one), invites, answers, changes the role, removes and leaves, and trashes the project at the end.
 * WRITTEN FROM THE BACKEND CODE AND NOT YET RUN against a live server (the cloud session has no PHP 8.4): the first live
 * run may need small corrections to what is expected. Known backend defects are `it.fails` and flip when fixed (request file C-22). Opt-in for the write part:
 *
 *   CONTRACT_WRITE=1 CONTRACT_EMAIL=... CONTRACT_PASSWORD=... npm run test:contract
 */
const BASE = process.env.CONTRACT_BASE_URL ?? 'http://127.0.0.1:8000'
const EMAIL = process.env.CONTRACT_EMAIL
const PASSWORD = process.env.CONTRACT_PASSWORD
const WRITE = process.env.CONTRACT_WRITE === '1'

const reachable = await fetch(`${BASE}/up`).then(
  (r) => r.ok,
  () => false,
)

async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let parsed: Record<string, any> = {}
  try {
    parsed = text ? JSON.parse(text) : {}
  } catch {
    parsed = { raw: text.slice(0, 200) }
  }
  return { status: res.status, body: parsed }
}

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`members and invitations (${BASE})`, () => {
  const stamp = Date.now()
  const guestEmail = `contract-guest-${stamp}@example.test`
  const guestPassword = 'password123'
  let owner = ''
  let guest = ''
  let guestId = 0
  let projectId = 0
  let inviteId = 0
  let inviteToken = ''
  let ownerId = 0

  const asOwner = (method: string, path: string, body?: unknown) => call(method, `/projects/${projectId}${path}`, body, owner)
  const asGuest = (method: string, path: string, body?: unknown) => call(method, path, body, guest)

  it('sets up an owner, a project and an approved guest account', async () => {
    owner = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    ownerId = (await call('GET', '/auth/me', undefined, owner)).body.data.id
    const made = await call('POST', '/projects', { title: `[contract-test] members ${stamp}`, question: 'Members?', scope: 'Contract testing only.', languages: ['en'], stage: 'scoping', tags: [] }, owner)
    expect(made.status).toBe(201)
    projectId = made.body.data.id
    const applied = await call('POST', '/applications', {
      display_name: `[contract-test] guest ${stamp}`,
      email: guestEmail,
      password: guestPassword,
      password_confirmation: guestPassword,
      research_interests: 'Contract testing',
      preferred_language: 'en',
    })
    expect(applied.status).toBe(201)
    guestId = applied.body.data.user.id
    await call('PATCH', `/admin/users/${guestId}/status`, { status: 'pending', reason: 'Contract test: stand in for email verification' }, owner)
    await call('POST', `/admin/applications/${applied.body.data.application.id}/decide`, { decision: 'approved', decision_reason: 'Contract test account' }, owner)
    guest = (await call('POST', '/auth/login', { email: guestEmail, password: guestPassword })).body.data.token
    expect(guest).toBeTruthy()
  })

  it('lists the members with only the fields the screen reads, and no e-mail addresses', async () => {
    const res = await asOwner('GET', '/members')
    expect(res.status).toBe(200)
    const rows = z.array(memberSchema).parse(res.body.data)
    expect(JSON.stringify(res.body.data)).not.toContain('@')
    expect(rows.every((m) => typeof m.user_id === 'number')).toBe(true)
  })

  it('creates an invitation by e-mail, with a token, and refuses the same address twice', async () => {
    const res = await asOwner('POST', '/invitations', { email: guestEmail, role: 'reviewer', expires_days: 14 })
    expect(res.status).toBe(201)
    const inv = invitationSchema.parse(res.body.data)
    inviteId = inv.id
    inviteToken = inv.token ?? ''
    expect(inv).toMatchObject({ role: 'reviewer', status: 'pending' })
    expect(inviteToken.length).toBeGreaterThan(20)
    expect((await asOwner('POST', '/invitations', { email: guestEmail, role: 'reviewer' })).status).toBe(409)
  })

  it('refuses the owner role in an invitation and an unknown role', async () => {
    expect((await asOwner('POST', '/invitations', { email: `x-${stamp}@example.test`, role: 'owner' })).status).toBe(422)
    expect((await asOwner('POST', '/invitations', { email: `x-${stamp}@example.test`, role: 'wizard' })).status).toBe(422)
  })

  it('lists the invitations for the owner and refuses everyone else with the same answer as a missing project', async () => {
    const list = await asOwner('GET', '/invitations')
    expect(list.status).toBe(200)
    expect(z.array(invitationSchema).parse(list.body.data).some((i) => i.id === inviteId)).toBe(true)
    expect(list.body.meta.pagination).toMatchObject({ current_page: 1 })
    expect((await asGuest('GET', `/projects/${projectId}/invitations`)).status).toBe(404)
  })

  it('previews an invitation without signing in, and shows no e-mail address', async () => {
    const res = await call('GET', `/invitations/${inviteToken}`)
    expect(res.status).toBe(200)
    const p = invitationPreviewSchema.parse(res.body.data)
    expect(p).toMatchObject({ project_id: projectId, role: 'reviewer', status: 'pending' })
    expect(JSON.stringify(res.body.data)).not.toContain(guestEmail)
    expect((await call('GET', '/invitations/not-a-token')).status).toBe(404)
  })

  it('does not let the project be read before the invitation is accepted', async () => {
    expect((await asGuest('GET', `/projects/${projectId}`)).status).toBe(404)
  })

  it('refuses an invitation sent to another address', async () => {
    const other = await asOwner('POST', '/invitations', { email: `other-${stamp}@example.test`, role: 'viewer' })
    const t = other.body.data.token
    expect((await asGuest('POST', `/invitations/${t}/accept`)).status).toBe(403)
    await asOwner('DELETE', `/invitations/${other.body.data.id}`)
  })

  it('accepts the invitation, and the guest is then a member with the invited role', async () => {
    expect((await asGuest('POST', `/invitations/${inviteToken}/accept`)).status).toBe(200)
    expect((await asGuest('GET', `/projects/${projectId}`)).status).toBe(200)
    const rows = z.array(memberSchema).parse((await asOwner('GET', '/members')).body.data)
    expect(rows.find((m) => m.user_id === guestId)).toMatchObject({ role: 'reviewer' })
    expect((await asGuest('POST', `/invitations/${inviteToken}/accept`)).status).toBeGreaterThanOrEqual(400)
  })

  it('does not let a reviewer invite, change roles or read the invitations', async () => {
    expect((await asGuest('POST', `/projects/${projectId}/invitations`, { email: `y-${stamp}@example.test`, role: 'viewer' })).status).toBe(403)
    expect((await asGuest('PATCH', `/projects/${projectId}/members/${ownerId}`, { role: 'viewer' })).status).toBe(403)
    expect((await asGuest('GET', `/projects/${projectId}/invitations`)).status).toBe(403)
  })

  it('changes the role through the project route, reads it back, and refuses owner', async () => {
    const res = await asOwner('PATCH', `/members/${guestId}`, { role: 'viewer' })
    expect(res.status).toBe(200)
    expect(membershipSchema.parse(res.body.data).role).toBe('viewer')
    expect((await asOwner('PATCH', `/members/${guestId}`, { role: 'owner' })).status).toBe(422)
    expect((await asOwner('PATCH', `/members/${ownerId}`, { role: 'viewer' })).status).toBeGreaterThanOrEqual(400)
  })

  it('C-22: the other role route refuses "owner" as a role', async () => {
    const res = await asOwner('PUT', `/members/${guestId}`, { role: 'owner' })
    expect(res.status).toBe(422)
    await asOwner('PATCH', `/members/${guestId}`, { role: 'viewer' })
  })

  it('C-22: the member list has only people who are members now', async () => {
    const rows = z.array(memberSchema).parse((await asOwner('GET', '/members')).body.data)
    expect(rows.every((m) => m.status === 'accepted')).toBe(true)
  })

  it('C-22: the contribution summary counts the member’s own findings, not the project’s', async () => {
    const rows = z.array(memberSchema).parse((await asOwner('GET', '/members')).body.data)
    const guestRow = rows.find((m) => m.user_id === guestId)
    expect((guestRow?.contribution_summary as { findings?: number } | undefined)?.findings ?? 0).toBe(0)
  })

  it('C-22: an accepted invitation cannot be sent again', async () => {
    expect((await asOwner('POST', `/invitations/${inviteId}/resend`)).status).toBe(409)
  })

  it('withdraws an invitation and the link stops working', async () => {
    const again = await asOwner('POST', '/invitations', { email: `late-${stamp}@example.test`, role: 'viewer' })
    const id = again.body.data.id
    const tok = again.body.data.token
    expect((await asOwner('DELETE', `/invitations/${id}`)).status).toBe(200)
    expect((await call('GET', `/invitations/${tok}`)).status).toBe(404)
  })

  it('removes a member: they lose access at once', async () => {
    expect((await asOwner('DELETE', `/members/${guestId}`)).status).toBe(200)
    expect((await asGuest('GET', `/projects/${projectId}`)).status).toBe(404)
    expect((await asOwner('DELETE', `/members/${ownerId}`)).status).toBeGreaterThanOrEqual(400)
  })

  it('lets a member leave, and the owner cannot', async () => {
    const inv = await asOwner('POST', '/invitations', { email: guestEmail, role: 'viewer' })
    await asGuest('POST', `/invitations/${inv.body.data.token}/accept`)
    expect((await asGuest('POST', `/projects/${projectId}/leave`)).status).toBe(200)
    expect((await asGuest('GET', `/projects/${projectId}`)).status).toBe(404)
    expect((await asOwner('POST', '/leave')).status).toBe(409)
  })

  it('cleans up: trashes the project and leaves the guest as a declined account', async () => {
    expect((await call('DELETE', `/projects/${projectId}`, undefined, owner)).status).toBe(200)
    expect((await call('PATCH', `/admin/users/${guestId}/status`, { status: 'rejected', reason: 'Contract test finished' }, owner)).status).toBe(200)
  })
})
