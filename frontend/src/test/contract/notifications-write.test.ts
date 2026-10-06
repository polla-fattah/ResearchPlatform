import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { notificationPageSchema, notificationSchema } from '@/api/schemas/notifications'

/**
 * Contract test for the notification list (screen 17). A notification is made the only way a researcher can cause one
 * today: the demo account invites a throwaway researcher to a throwaway project, which notifies them. The project is
 * trashed at the end and the researcher stays as a declined account. Known backend defects are `it.fails` (request file
 * C-24). WRITTEN FROM THE BACKEND CODE AND NOT YET RUN against a live server (the cloud session has no PHP 8.4). Opt-in:
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

describe.skipIf(!reachable || !EMAIL || !PASSWORD)(`notifications, read (${BASE})`, () => {
  it('lists the account’s notifications with the unread count, paged', async () => {
    const token = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    const res = await call('GET', '/notifications', undefined, token)
    expect(res.status).toBe(200)
    const page = notificationPageSchema.parse(res.body.data)
    expect(page.unread_count).toBeGreaterThanOrEqual(0)
    expect(res.body.meta.pagination).toMatchObject({ current_page: 1 })
  })
})

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`notifications, write (${BASE})`, () => {
  const stamp = Date.now()
  const guestEmail = `contract-notify-${stamp}@example.test`
  let owner = ''
  let guest = ''
  let guestId = 0
  let projectId = 0
  let noteId = 0

  it('sets up a researcher and gives them one notification by inviting them', async () => {
    owner = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    projectId = (await call('POST', '/projects', { title: `[contract-test] notify ${stamp}`, question: 'Notify?', scope: 'Contract testing only.', languages: ['en'], stage: 'scoping', tags: [] }, owner)).body.data.id
    const applied = await call('POST', '/applications', {
      display_name: `[contract-test] notify ${stamp}`,
      email: guestEmail,
      password: 'password123',
      password_confirmation: 'password123',
      research_interests: 'Contract testing',
      preferred_language: 'en',
    })
    guestId = applied.body.data.user.id
    await call('PATCH', `/admin/users/${guestId}/status`, { status: 'pending', reason: 'Contract test: stand in for email verification' }, owner)
    await call('POST', `/admin/applications/${applied.body.data.application.id}/decide`, { decision: 'approved', decision_reason: 'Contract test account' }, owner)
    guest = (await call('POST', '/auth/login', { email: guestEmail, password: 'password123' })).body.data.token
    expect((await call('POST', `/projects/${projectId}/invitations`, { email: guestEmail, role: 'viewer' }, owner)).status).toBe(201)
  })

  it('shows the invitation as one unread notification about the project, and counts it', async () => {
    const res = await call('GET', '/notifications', undefined, guest)
    const page = notificationPageSchema.parse(res.body.data)
    expect(page.unread_count).toBe(1)
    const n = page.notifications[0]!
    noteId = n.id
    expect(n).toMatchObject({ type: 'invitation', target_type: 'project', target_id: projectId, is_read: false })
    expect((await call('GET', '/notifications/unread-count', undefined, guest)).body.data.unread_count).toBe(1)
  })

  it('filters by type on the server', async () => {
    const hit = notificationPageSchema.parse((await call('GET', '/notifications?type=invitation', undefined, guest)).body.data)
    expect(hit.notifications).toHaveLength(1)
    const miss = notificationPageSchema.parse((await call('GET', '/notifications?type=assignment', undefined, guest)).body.data)
    expect(miss.notifications).toHaveLength(0)
  })

  it('does not show one researcher another’s notifications, nor let them be marked read', async () => {
    const mine = notificationPageSchema.parse((await call('GET', '/notifications', undefined, owner)).body.data)
    expect(mine.notifications.some((n) => n.id === noteId)).toBe(false)
    expect((await call('PATCH', `/notifications/${noteId}/read`, undefined, owner)).status).toBe(404)
  })

  it('marks one as read with a time, and the count drops', async () => {
    const res = await call('PATCH', `/notifications/${noteId}/read`, undefined, guest)
    expect(res.status).toBe(200)
    expect(notificationSchema.parse(res.body.data)).toMatchObject({ is_read: true })
    expect((await call('GET', '/notifications/unread-count', undefined, guest)).body.data.unread_count).toBe(0)
  })

  it('marks all as read', async () => {
    await call('POST', `/projects/${projectId}/invitations`, { email: `second-${stamp}@example.test`, role: 'viewer' }, owner)
    expect((await call('POST', '/notifications/mark-all-read', undefined, guest)).status).toBe(200)
    expect(notificationPageSchema.parse((await call('GET', '/notifications', undefined, guest)).body.data).unread_count).toBe(0)
  })

  it.fails('C-24: a notification says which project it is about, whatever it is about', async () => {
    const page = notificationPageSchema.passthrough().parse((await call('GET', '/notifications', undefined, guest)).body.data)
    const row = page.notifications[0] as Record<string, unknown>
    expect(row.project_id).toBeTruthy()
  })

  it.fails('C-24: an invitation notification carries what is needed to answer it', async () => {
    const page = notificationPageSchema.passthrough().parse((await call('GET', '/notifications', undefined, guest)).body.data)
    const row = page.notifications.find((n) => n.type === 'invitation') as Record<string, unknown> | undefined
    expect(row?.invitation_token ?? row?.action_url).toBeTruthy()
  })

  it('C-24: a notification the person has turned off is not made', async () => {
    await call('PATCH', '/notifications/preferences', { notify_invitations: false }, guest)
    const before = notificationPageSchema.parse((await call('GET', '/notifications', undefined, guest)).body.data).notifications.length
    await call('POST', `/projects/${projectId}/invitations`, { email: guestEmail.replace('contract-notify', 'contract-notify-b'), role: 'viewer' }, owner)
    await call('POST', `/projects/${projectId}/invitations`, { email: guestEmail, role: 'researcher' }, owner)
    const after = notificationPageSchema.parse((await call('GET', '/notifications', undefined, guest)).body.data).notifications.length
    expect(after).toBe(before)
  })

  it('cleans up: trashes the project and leaves the researcher as a declined account', async () => {
    expect((await call('DELETE', `/projects/${projectId}`, undefined, owner)).status).toBe(200)
    expect(z.number().parse(guestId)).toBeGreaterThan(0)
    expect((await call('PATCH', `/admin/users/${guestId}/status`, { status: 'rejected', reason: 'Contract test finished' }, owner)).status).toBe(200)
  })
})
