import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { assignmentSchema } from '@/api/schemas/review'

/**
 * Contract test for the reviewer workspace (screen 23). Two throwaway researchers: an author who submits a package and a
 * reviewer; the demo account (an administrator, so an editor) assigns the reviewer. The reviewer reads the list and the
 * assignment, declares, accepts, reviews, and a second assignment is declined. The author's project is trashed and both
 * accounts stay as declined accounts. Known backend defects are `it.fails` (request file C-31). WRITTEN FROM THE BACKEND
 * CODE AND NOT YET RUN against a live server (the cloud session has no PHP 8.4). Opt-in:
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
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`reviewer workspace (${BASE})`, () => {
  const stamp = Date.now()
  let admin = ''
  const people = { author: { token: '', id: 0 }, reviewer: { token: '', id: 0 } }
  let projectId = 0
  let submissionId = 0
  let assignmentId = 0

  const asAdmin = (method: string, path: string, body?: unknown) => call(method, path, body, admin)
  const as = (who: keyof typeof people, method: string, path: string, body?: unknown) => call(method, path, body, people[who].token)

  async function account(who: keyof typeof people) {
    const email = `contract-${who}-${stamp}@example.test`
    const applied = await call('POST', '/applications', { display_name: `[contract-test] ${who} ${stamp}`, email, password: 'password123', password_confirmation: 'password123', research_interests: 'Contract testing', preferred_language: 'en' })
    people[who].id = applied.body.data.user.id
    await asAdmin('PATCH', `/admin/users/${people[who].id}/status`, { status: 'pending', reason: 'Contract test: stand in for email verification' })
    await asAdmin('POST', `/admin/applications/${applied.body.data.application.id}/decide`, { decision: 'approved', decision_reason: 'Contract test account' })
    people[who].token = (await call('POST', '/auth/login', { email, password: 'password123' })).body.data.token
  }

  it('sets up an author with a package, a reviewer, and an assignment made by the editor', async () => {
    admin = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    await account('author')
    await account('reviewer')
    projectId = (await as('author', 'POST', '/projects', { title: `[contract-test] review ${stamp}`, question: 'Review?', scope: 'Contract testing only.', languages: ['en'], stage: 'writing', tags: [] })).body.data.id
    const docId = (await as('author', 'POST', `/projects/${projectId}/documents`, { title: 'Article', document_type: 'article', language: 'en' })).body.data.id
    await as('author', 'POST', `/projects/${projectId}/documents/${docId}/versions`, { content: 'Body.', change_summary: 'first', expected_version: 0 })
    const sub = await as('author', 'POST', `/projects/${projectId}/submissions`, { title: `[contract-test] ${stamp}`, abstract: 'An abstract.', document_ids: [docId], keywords: [], rights_declaration: 'CC-BY-4.0', coi_declared: true })
    submissionId = sub.body.data.id
    const assign = await asAdmin('POST', `/editor/submissions/${submissionId}/assign`, { reviewer_id: people.reviewer.id })
    expect(assign.status).toBe(201)
    assignmentId = assign.body.data.id
  })

  it('lists only the reviewer’s own assignments, and 404s another person’s', async () => {
    const mine = z.array(assignmentSchema).parse((await as('reviewer', 'GET', '/reviews/assignments')).body.data)
    expect(mine.map((a) => a.id)).toContain(assignmentId)
    expect((await as('author', 'GET', '/reviews/assignments')).body.data).toEqual([])
    expect((await as('author', 'GET', `/reviews/assignments/${assignmentId}`)).status).toBe(404)
  })

  it('opens the assignment with the frozen package', async () => {
    const res = await as('reviewer', 'GET', `/reviews/assignments/${assignmentId}`)
    expect(res.status).toBe(200)
    const a = assignmentSchema.parse(res.body.data)
    expect(a.submission?.frozen_package?.documents?.[0]?.title).toBe('Article')
  })

  it('records a declaration and an acceptance', async () => {
    expect((await as('reviewer', 'POST', `/reviews/assignments/${assignmentId}/coi-declaration`, { coi_confirmed: true })).status).toBe(200)
    expect((await as('reviewer', 'POST', `/reviews/assignments/${assignmentId}/accept`)).status).toBe(200)
  })

  it('refuses a review without a recommendation or with notes under ten characters, then accepts one', async () => {
    expect((await as('reviewer', 'POST', `/reviews/assignments/${assignmentId}/recommendation`, { reviewer_notes: 'Fine enough work.' })).status).toBe(422)
    expect((await as('reviewer', 'POST', `/reviews/assignments/${assignmentId}/recommendation`, { recommendation: 'approve', reviewer_notes: 'short' })).status).toBe(422)
    const ok = await as('reviewer', 'POST', `/reviews/assignments/${assignmentId}/recommendation`, { recommendation: 'approve', score: 8, reviewer_notes: 'Sound and clearly argued.', coi_confirmed: true })
    expect(ok.status).toBe(200)
    const a = assignmentSchema.parse(ok.body.data)
    expect(a).toMatchObject({ recommendation: 'approve', score: 8 })
    expect(a.completed_at).toBeTruthy()
  })

  it('lets the editor see the finished review with its reviewer', async () => {
    const one = (await asAdmin('GET', `/editor/submissions/${submissionId}`)).body.data
    expect(one.reviews[0].reviewer.display_name).toContain('reviewer')
    expect(one.reviews[0].completed_at).toBeTruthy()
  })

  it.fails('C-31: the reviewer’s package does not name the submitter or the project', async () => {
    const text = JSON.stringify((await as('reviewer', 'GET', `/reviews/assignments/${assignmentId}`)).body.data)
    expect(text).not.toMatch(/submitted_by|"project_id"|"owner"|"submitter"/)
  })

  it.fails('C-31: a finished review cannot be sent again', async () => {
    const again = await as('reviewer', 'POST', `/reviews/assignments/${assignmentId}/recommendation`, { recommendation: 'reject', reviewer_notes: 'Changed my mind about this.' })
    expect(again.status).toBe(409)
  })

  it.fails('C-31: declining keeps a record of the assignment', async () => {
    const second = await asAdmin('POST', `/editor/submissions/${submissionId}/assign`, { reviewer_id: people.author.id })
    // The author is blocked from review (conflict), so use the editor's own account for the second assignment.
    const own = await asAdmin('POST', `/editor/submissions/${submissionId}/assign`, { reviewer_id: (await asAdmin('GET', '/auth/me')).body.data.id })
    expect(second.status).toBe(422)
    const id = own.body.data.id
    expect((await asAdmin('POST', `/reviews/assignments/${id}/decline`)).status).toBe(200)
    const kept = (await asAdmin('GET', `/editor/submissions/${submissionId}`)).body.data.reviews.some((r: { id: number }) => r.id === id)
    expect(kept).toBe(true)
  })

  it('cleans up: trashes the project and leaves both accounts as declined accounts', async () => {
    expect((await as('author', 'DELETE', `/projects/${projectId}`)).status).toBe(200)
    for (const who of ['author', 'reviewer'] as const) {
      expect((await asAdmin('PATCH', `/admin/users/${people[who].id}/status`, { status: 'rejected', reason: 'Contract test finished' })).status).toBe(200)
    }
  })
})
