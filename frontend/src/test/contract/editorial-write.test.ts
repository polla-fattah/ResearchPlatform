import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { candidateSchema, decisionResultSchema, editorSubmissionSchema, publicationRefSchema } from '@/api/schemas/editorial'

/**
 * Contract test for the editorial console (screen 22). A throwaway researcher owns a throwaway project and submits a
 * package; the demo account (an administrator, so an editor) works the queue: reads it, assigns itself as reviewer,
 * decides, releases, corrects and retracts. A publication cannot be deleted, so the run leaves one retracted
 * `contract-pub-…` publication behind; the project is trashed and the researcher stays as a declined account.
 * Known backend defects are `it.fails` (request file C-30). WRITTEN FROM THE BACKEND CODE AND NOT YET RUN against a live
 * server (the cloud session has no PHP 8.4). Opt-in for the write part:
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

describe.skipIf(!reachable || !EMAIL || !PASSWORD)(`editorial queue, read (${BASE})`, () => {
  it('lists submissions for an editor, paged, in the shape the console reads', async () => {
    const token = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    const res = await call('GET', '/editor/submissions', undefined, token)
    expect(res.status).toBe(200)
    z.array(editorSubmissionSchema).parse(res.body.data)
    expect(res.body.meta.pagination).toMatchObject({ current_page: 1 })
  })
})

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`editorial, write (${BASE})`, () => {
  const stamp = Date.now()
  const guestEmail = `contract-author-${stamp}@example.test`
  let admin = ''
  let adminId = 0
  let guest = ''
  let guestId = 0
  let projectId = 0
  let docId = 0
  let submissionId = 0
  let secondId = 0
  let publicationId = 0

  const asAdmin = (method: string, path: string, body?: unknown) => call(method, path, body, admin)
  const asGuest = (method: string, path: string, body?: unknown) => call(method, path, body, guest)
  const pack = (over: Record<string, unknown> = {}) => ({ title: `[contract-test] ${stamp}`, abstract: 'An abstract.', document_ids: [docId], keywords: ['test'], rights_declaration: 'CC-BY-4.0', coi_declared: true, ...over })

  it('sets up an author who has submitted a package', async () => {
    admin = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    adminId = (await call('GET', '/auth/me', undefined, admin)).body.data.id
    const applied = await call('POST', '/applications', { display_name: `[contract-test] author ${stamp}`, email: guestEmail, password: 'password123', password_confirmation: 'password123', research_interests: 'Contract testing', preferred_language: 'en' })
    guestId = applied.body.data.user.id
    await asAdmin('PATCH', `/admin/users/${guestId}/status`, { status: 'pending', reason: 'Contract test: stand in for email verification' })
    await asAdmin('POST', `/admin/applications/${applied.body.data.application.id}/decide`, { decision: 'approved', decision_reason: 'Contract test account' })
    guest = (await call('POST', '/auth/login', { email: guestEmail, password: 'password123' })).body.data.token
    projectId = (await asGuest('POST', '/projects', { title: `[contract-test] editorial ${stamp}`, question: 'Edit?', scope: 'Contract testing only.', languages: ['en'], stage: 'writing', tags: [] })).body.data.id
    docId = (await asGuest('POST', `/projects/${projectId}/documents`, { title: 'Article', document_type: 'article', language: 'en' })).body.data.id
    await asGuest('POST', `/projects/${projectId}/documents/${docId}/versions`, { content: 'Body.', change_summary: 'first', expected_version: 0 })
    const sub = await asGuest('POST', `/projects/${projectId}/submissions`, pack())
    expect(sub.status).toBe(201)
    submissionId = sub.body.data.id
  })

  it('refuses everyone but an editor', async () => {
    expect((await asGuest('GET', '/editor/submissions')).status).toBe(403)
    expect((await asGuest('GET', `/editor/submissions/${submissionId}`)).status).toBe(403)
  })

  it('shows the editor the package in the queue with its project and owner, and the stage filters work', async () => {
    const queue = z.array(editorSubmissionSchema).parse((await asAdmin('GET', '/editor/submissions?stage=triage&per_page=100')).body.data)
    expect(queue.find((s) => s.id === submissionId)).toMatchObject({ status: 'submitted' })
    const one = editorSubmissionSchema.parse((await asAdmin('GET', `/editor/submissions/${submissionId}`)).body.data)
    expect(one.project?.owner?.id).toBe(guestId)
  })

  it('offers reviewer candidates with the conflict analysis: the author is blocked', async () => {
    const list = z.array(candidateSchema).parse((await asAdmin('GET', `/editor/submissions/${submissionId}/reviewer-candidates`)).body.data)
    expect(list.find((c) => c.id === guestId)?.coi?.blocked).toBe(true)
    expect(list.find((c) => c.id === adminId)?.coi?.blocked).toBe(false)
  })

  it('refuses to assign the author, then assigns the editor’s own account as reviewer, and the package goes under review', async () => {
    expect((await asAdmin('POST', `/editor/submissions/${submissionId}/assign`, { reviewer_id: guestId })).status).toBe(422)
    const ok = await asAdmin('POST', `/editor/submissions/${submissionId}/assign`, { reviewer_id: adminId })
    expect(ok.status).toBe(201)
    expect(editorSubmissionSchema.parse((await asAdmin('GET', `/editor/submissions/${submissionId}`)).body.data).status).toBe('in_review')
    expect((await asAdmin('POST', `/editor/submissions/${submissionId}/assign`, { reviewer_id: adminId })).status).toBe(422)
  })

  it('will not approve before a review is finished, and needs a reason', async () => {
    const res = await asAdmin('POST', `/editor/submissions/${submissionId}/decision`, { decision: 'approve', decision_notes: 'Looks fine to me.' })
    expect(res.status).toBe(422)
    expect(res.body.error?.code).toBe('PEER_REVIEW_REQUIRED')
    expect((await asAdmin('POST', `/editor/submissions/${submissionId}/decision`, { decision: 'reject', decision_notes: 'short' })).status).toBe(422)
  })

  it('requests revisions, and the author then sees the decision and its note but no reviewer', async () => {
    const res = await asAdmin('POST', `/editor/submissions/${submissionId}/decision`, { decision: 'request_revisions', decision_notes: 'Please add a limitations section.' })
    expect(decisionResultSchema.parse(res.body.data).submission_status).toBe('revision_requested')
    const mine = await asGuest('GET', `/projects/${projectId}/submissions`)
    expect(JSON.stringify(mine.body.data)).toContain('Please add a limitations section.')
  })

  it('takes a response as a new package that names its parent, then a finished review allows approval', async () => {
    const second = await asGuest('POST', `/projects/${projectId}/submissions`, pack({ parent_submission_id: submissionId, author_response_notes: 'Added section 5.' }))
    expect(second.status).toBe(201)
    secondId = second.body.data.id
    expect(second.body.data.version_number).toBe(2)
    const assign = await asAdmin('POST', `/editor/submissions/${secondId}/assign`, { reviewer_id: adminId })
    expect(assign.status).toBe(201)
    const review = await asAdmin('POST', `/reviews/assignments/${assign.body.data.id}/recommendation`, { recommendation: 'approve', reviewer_notes: 'Sound and clearly argued.', score: 8 })
    expect(review.status).toBe(200)
    const decided = await asAdmin('POST', `/editor/submissions/${secondId}/decision`, { decision: 'approve', decision_notes: 'Approved after revision.' })
    expect(decisionResultSchema.parse(decided.body.data).submission_status).toBe('approved')
  })

  it('releases only an approved package, with an address that is unused, and the public list then shows it', async () => {
    expect((await asAdmin('POST', `/editor/submissions/${submissionId}/release`, { public_slug: `contract-pub-${stamp}-x` })).status).toBe(422)
    const rel = await asAdmin('POST', `/editor/submissions/${secondId}/release`, { public_slug: `contract-pub-${stamp}`, version_string: '1.0.0' })
    expect(rel.status).toBe(201)
    publicationId = publicationRefSchema.parse(rel.body.data).id
    expect((await asAdmin('POST', `/editor/submissions/${secondId}/release`, { public_slug: `contract-pub-${stamp}` })).status).toBe(422)
    const list = (await call('GET', '/public/research?per_page=100')).body.data as { public_slug: string }[]
    expect(list.some((p) => p.public_slug === `contract-pub-${stamp}`)).toBe(true)
  })

  it.fails('C-30: a package that was released cannot be decided on again', async () => {
    const res = await asAdmin('POST', `/editor/submissions/${secondId}/decision`, { decision: 'reject', decision_notes: 'Changed my mind after release.' })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it.fails('C-30: the DOI is not invented when none is given', async () => {
    const pub = publicationRefSchema.parse((await asAdmin('GET', `/editor/submissions/${secondId}`)).body.data.publication)
    expect(pub.doi ?? '').not.toContain('openhadith')
  })

  it.fails('C-30: a queue row does not carry the whole frozen package', async () => {
    const rows = (await asAdmin('GET', '/editor/submissions?per_page=5')).body.data as Record<string, unknown>[]
    expect(rows.some((r) => 'frozen_package' in r)).toBe(false)
  })

  it('adds a correction and retracts the publication, keeping its public status', async () => {
    expect(publicationRefSchema.parse((await asAdmin('POST', `/editor/publications/${publicationId}/corrigenda`, { notice: 'Fixed a citation in section 3.', new_version_string: '1.0.1' })).body.data).version_string).toBe('1.0.1')
    expect((await asAdmin('POST', `/editor/publications/${publicationId}/retract`, { retraction_reason: 'Contract test finished.' })).status).toBe(200)
    const page = await call('GET', `/public/research/contract-pub-${stamp}`)
    expect(page.status).toBe(200)
    expect(JSON.stringify(page.body.data)).toContain('retracted')
  })

  it('cleans up: trashes the project and leaves the author as a declined account', async () => {
    expect((await asGuest('DELETE', `/projects/${projectId}`)).status).toBe(200)
    expect((await asAdmin('PATCH', `/admin/users/${guestId}/status`, { status: 'rejected', reason: 'Contract test finished' })).status).toBe(200)
  })
})
