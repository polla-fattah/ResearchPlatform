import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { commentSchema, taskSchema, threadSchema } from '@/api/schemas/discussion'

/**
 * Contract test for discussions and tasks (screen 16). It creates a throwaway project owned by the demo account and a
 * throwaway researcher invited as a viewer (taken through the application workflow; the account stays as a declined
 * one), and trashes the project at the end. Known backend defects are `it.fails` and flip when fixed (request file C-23).
 * WRITTEN FROM THE BACKEND CODE AND NOT YET RUN against a live server (the cloud session has no PHP 8.4): the first live
 * run may need small corrections to what is expected. Opt-in for the write part:
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

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`discussions and tasks (${BASE})`, () => {
  const stamp = Date.now()
  const guestEmail = `contract-viewer-${stamp}@example.test`
  let owner = ''
  let guest = ''
  let guestId = 0
  let ownerId = 0
  let projectId = 0
  let threadId = 0
  let taskId = 0

  const asOwner = (method: string, path: string, body?: unknown) => call(method, `/projects/${projectId}${path}`, body, owner)

  it('sets up a project and a viewer', async () => {
    owner = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    ownerId = (await call('GET', '/auth/me', undefined, owner)).body.data.id
    const made = await call('POST', '/projects', { title: `[contract-test] discussion ${stamp}`, question: 'Talk?', scope: 'Contract testing only.', languages: ['en'], stage: 'scoping', tags: [] }, owner)
    expect(made.status).toBe(201)
    projectId = made.body.data.id
    const applied = await call('POST', '/applications', {
      display_name: `[contract-test] viewer ${stamp}`,
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
    const inv = await asOwner('POST', '/invitations', { email: guestEmail, role: 'viewer' })
    expect((await call('POST', `/invitations/${inv.body.data.token}/accept`, undefined, guest)).status).toBe(200)
  })

  it('opens a discussion about the project with a first comment, and lists it with its reply count', async () => {
    const res = await asOwner('POST', '/discussions', { title: 'Scope?', target_type: 'project', target_id: projectId, initial_comment: 'Is the scope right?' })
    expect(res.status).toBe(201)
    threadId = threadSchema.parse(res.body.data).id
    const list = await asOwner('GET', '/discussions')
    expect(list.status).toBe(200)
    const rows = z.array(threadSchema).parse(list.body.data)
    expect(rows.find((t) => t.id === threadId)).toMatchObject({ is_resolved: false, comments_count: 1 })
    expect(list.body.meta.pagination).toMatchObject({ current_page: 1 })
  })

  it('filters the list by what it is about', async () => {
    const hit = await asOwner('GET', `/discussions?target_type=project&target_id=${projectId}`)
    expect(z.array(threadSchema).parse(hit.body.data).some((t) => t.id === threadId)).toBe(true)
    const miss = await asOwner('GET', '/discussions?target_type=evidence&target_id=999999999')
    expect(z.array(threadSchema).parse(miss.body.data)).toHaveLength(0)
  })

  it('refuses a discussion without a first comment or about something it does not know', async () => {
    expect((await asOwner('POST', '/discussions', { title: 'x', target_type: 'project', target_id: projectId })).status).toBe(422)
    expect((await asOwner('POST', '/discussions', { title: 'x', target_type: 'wizard', target_id: 1, initial_comment: 'y' })).status).toBe(422)
  })

  it('lists and adds replies, oldest first, with their authors', async () => {
    const add = await call('POST', `/discussions/${threadId}/comments`, { content: 'A reply.' }, owner)
    expect(add.status).toBe(201)
    commentSchema.parse(add.body.data)
    const list = await call('GET', `/discussions/${threadId}/comments`, undefined, owner)
    const rows = z.array(commentSchema).parse(list.body.data)
    expect(rows.map((c) => c.content)).toEqual(['Is the scope right?', 'A reply.'])
    expect(rows[0]?.author?.display_name).toBeTruthy()
  })

  it('lets a viewer read but not reply or open a discussion', async () => {
    expect((await call('GET', `/discussions/${threadId}/comments`, undefined, guest)).status).toBe(200)
    expect((await call('POST', `/discussions/${threadId}/comments`, { content: 'x' }, guest)).status).toBe(403)
    expect((await call('POST', `/projects/${projectId}/discussions`, { title: 'x', target_type: 'project', target_id: projectId, initial_comment: 'y' }, guest)).status).toBe(403)
  })

  it('needs a decision of three characters to resolve, and a viewer cannot resolve', async () => {
    expect((await call('POST', `/discussions/${threadId}/resolve`, { resolution_notes: 'ab' }, owner)).status).toBe(422)
    expect((await call('POST', `/discussions/${threadId}/resolve`, { resolution_notes: 'Fine as it is.' }, guest)).status).toBe(403)
    const ok = await call('POST', `/discussions/${threadId}/resolve`, { resolution_notes: 'Fine as it is.', alternative_interpretation: 'Wider scope.' }, owner)
    expect(ok.status).toBe(200)
    expect(threadSchema.parse(ok.body.data)).toMatchObject({ is_resolved: true, resolution_notes: 'Fine as it is.' })
  })

  it('creates a task with an assignee and a due day, and lists it with its assignee', async () => {
    const res = await asOwner('POST', '/tasks', { title: 'Collect the links', assignee_id: ownerId, due_date: '2026-12-31' })
    expect(res.status).toBe(201)
    const t = taskSchema.parse(res.body.data)
    taskId = t.id
    expect(t).toMatchObject({ status: 'open', assignee_id: ownerId })
    expect(t.due_date?.slice(0, 10)).toBe('2026-12-31')
    const list = await asOwner('GET', `/tasks?assignee_id=${ownerId}&status=open`)
    expect(z.array(taskSchema).parse(list.body.data).some((x) => x.id === taskId)).toBe(true)
  })

  it('changes a task, completes it with a finish time, and blocks another with a reason', async () => {
    const patched = await asOwner('PATCH', `/tasks/${taskId}`, { title: 'Collect the links (all)', status: 'in_progress' })
    expect(taskSchema.parse(patched.body.data)).toMatchObject({ title: 'Collect the links (all)', status: 'in_progress' })
    const done = taskSchema.parse((await asOwner('POST', `/tasks/${taskId}/complete`)).body.data)
    expect(done.status).toBe('done')
    expect(done.completed_at).toBeTruthy()
    const second = taskSchema.parse((await asOwner('POST', '/tasks', { title: 'Second' })).body.data)
    expect((await asOwner('POST', `/tasks/${second.id}/block`, { blocking_reason: 'no' })).status).toBe(422)
    const blocked = taskSchema.parse((await asOwner('POST', `/tasks/${second.id}/block`, { blocking_reason: 'Waiting for the scan' })).body.data)
    expect(blocked).toMatchObject({ status: 'blocked', blocking_reason: 'Waiting for the scan' })
  })

  it('does not let a viewer create a task', async () => {
    expect((await call('POST', `/projects/${projectId}/tasks`, { title: 'x' }, guest)).status).toBe(403)
  })

  it('C-23: a viewer cannot complete or block a task', async () => {
    expect((await call('POST', `/projects/${projectId}/tasks/${taskId}/complete`, undefined, guest)).status).toBe(403)
  })

  it('C-23: a viewer cannot change a task', async () => {
    expect((await call('PATCH', `/projects/${projectId}/tasks/${taskId}`, { title: 'Hijacked' }, guest)).status).toBe(403)
  })

  it.fails('C-23: a discussion says who opened it', async () => {
    const rows = z.array(threadSchema.passthrough()).parse((await asOwner('GET', '/discussions')).body.data)
    const row = rows.find((t) => t.id === threadId) as Record<string, unknown> | undefined
    expect(row?.author ?? row?.created_by).toBeTruthy()
  })

  it.fails('C-23: a single discussion can be read by id', async () => {
    expect((await call('GET', `/discussions/${threadId}`, undefined, owner)).status).toBe(200)
  })

  it('C-23: a resolved discussion can be reopened', async () => {
    expect((await call('POST', `/discussions/${threadId}/reopen`, undefined, owner)).status).toBe(200)
  })

  it('C-23: a discussion must be about an item that is in the project', async () => {
    const res = await asOwner('POST', '/discussions', { title: 'Elsewhere', target_type: 'evidence', target_id: 999999999, initial_comment: 'x' })
    expect(res.status).toBe(422)
  })

  it.fails('C-23: setting a task to done through the update records when it was finished', async () => {
    const fresh = taskSchema.parse((await asOwner('POST', '/tasks', { title: 'Done by patch' })).body.data)
    const patched = taskSchema.parse((await asOwner('PATCH', `/tasks/${fresh.id}`, { status: 'done' })).body.data)
    expect(patched.completed_at).toBeTruthy()
  })

  it('cleans up: trashes the project and leaves the viewer as a declined account', async () => {
    expect((await call('DELETE', `/projects/${projectId}`, undefined, owner)).status).toBe(200)
    expect((await call('PATCH', `/admin/users/${guestId}/status`, { status: 'rejected', reason: 'Contract test finished' }, owner)).status).toBe(200)
  })
})
