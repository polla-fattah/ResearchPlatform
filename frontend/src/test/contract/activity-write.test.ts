import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { activitySchema } from '@/api/schemas/activity'

/**
 * Contract test for a project's activity feed (screen 18). It creates a throwaway project, makes a few changes that
 * should be recorded (a task, a discussion, an invitation, a stage change), reads the feed with every filter the screen
 * uses, and trashes the project. Known backend defects are `it.fails` (request file C-25). WRITTEN FROM THE BACKEND CODE
 * AND NOT YET RUN against a live server (the cloud session has no PHP 8.4). Opt-in for the write part:
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

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`project activity (${BASE})`, () => {
  const stamp = Date.now()
  let owner = ''
  let ownerId = 0
  let projectId = 0

  const asOwner = (method: string, path: string, body?: unknown) => call(method, `/projects/${projectId}${path}`, body, owner)
  const feed = async (query = '') => z.array(activitySchema).parse((await asOwner('GET', `/activity${query}`)).body.data)

  it('records the changes a researcher makes, newest first, with who did them', async () => {
    owner = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    ownerId = (await call('GET', '/auth/me', undefined, owner)).body.data.id
    projectId = (await call('POST', '/projects', { title: `[contract-test] activity ${stamp}`, question: 'Activity?', scope: 'Contract testing only.', languages: ['en'], stage: 'scoping', tags: [] }, owner)).body.data.id
    expect((await asOwner('POST', '/tasks', { title: 'Recorded task' })).status).toBe(201)
    expect((await asOwner('POST', '/discussions', { title: 'Recorded thread', target_type: 'project', target_id: projectId, initial_comment: 'x' })).status).toBe(201)
    expect((await asOwner('POST', '/invitations', { email: `a-${stamp}@example.test`, role: 'viewer' })).status).toBe(201)
    expect((await asOwner('PATCH', '/stage', { stage: 'collecting' })).status).toBe(200)
    const rows = await feed()
    const actions = rows.map((r) => r.action)
    expect(actions).toEqual(expect.arrayContaining(['task_created', 'discussion_opened', 'invitation_created', 'stage_changed']))
    expect(rows[0]?.actor?.display_name).toBeTruthy()
    const times = rows.map((r) => Date.parse(r.created_at ?? ''))
    expect([...times].sort((a, b) => b - a)).toEqual(times)
  })

  it('filters by action, object, person and day, on the server', async () => {
    expect((await feed('?action=task_created')).every((r) => r.action === 'task_created')).toBe(true)
    expect((await feed('?object_type=discussion_thread')).every((r) => r.object_type === 'discussion_thread')).toBe(true)
    expect((await feed(`?actor_id=${ownerId}`)).length).toBeGreaterThan(0)
    expect(await feed('?actor_id=999999999')).toHaveLength(0)
    expect((await feed('?from=2999-01-01')).length).toBe(0)
    expect((await feed('?from=2000-01-01')).length).toBeGreaterThan(0)
  })

  it('pages, and answers 404 for a project the person cannot open', async () => {
    const res = await asOwner('GET', '/activity?per_page=2&page=1')
    expect(res.body.meta.pagination).toMatchObject({ current_page: 1, per_page: 2 })
    expect((await call('GET', '/projects/999999999/activity', undefined, owner)).status).toBe(404)
  })

  it('C-25: an invitation’s entry does not name the invited e-mail address', async () => {
    const row = (await feed('?action=invitation_created'))[0]
    expect(row?.summary ?? '').not.toContain('@')
  })

  it('C-25: a change to a finding or a document is recorded', async () => {
    expect((await asOwner('POST', '/findings', { question: 'A question?', claim: 'A claim', reasoning: 'x', status: 'provisional' })).status).toBe(201)
    expect((await feed('?object_type=finding')).length).toBeGreaterThan(0)
  })

  it('C-25: an entry names its object by its title', async () => {
    const row = ((await asOwner('GET', '/activity?action=task_created')).body.data as Record<string, unknown>[])[0]
    expect(row?.object_title ?? row?.object_label).toBeTruthy()
  })

  it('cleans up: trashes the project', async () => {
    expect((await call('DELETE', `/projects/${projectId}`, undefined, owner)).status).toBe(200)
  })
})
