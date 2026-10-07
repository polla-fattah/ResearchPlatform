import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { submissionSchema, validationSchema } from '@/api/schemas/submission'

/**
 * Contract test for the submission builder (screen 21). It creates a throwaway project with one document and one
 * saved version, runs the pre-publication check, submits a package and reads it back, and trashes the project.
 * Known backend defects are `it.fails` (request file C-29). WRITTEN FROM THE BACKEND CODE AND NOT YET RUN against a live
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

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`submission (${BASE})`, () => {
  const stamp = Date.now()
  let owner = ''
  let projectId = 0
  let docId = 0
  let submissionId = 0

  const asOwner = (method: string, path: string, body?: unknown) => call(method, `/projects/${projectId}${path}`, body, owner)
  const package_ = (over: Record<string, unknown> = {}) => ({ title: `[contract-test] ${stamp}`, abstract: 'An abstract.', document_ids: [docId], keywords: ['test'], rights_declaration: 'CC-BY-4.0', coi_declared: true, ...over })

  it('sets up a project with a document that has a saved version', async () => {
    owner = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    projectId = (await call('POST', '/projects', { title: `[contract-test] submission ${stamp}`, question: 'Submit?', scope: 'Contract testing only.', languages: ['en'], stage: 'writing', tags: [] }, owner)).body.data.id
    const made = await asOwner('POST', '/documents', { title: 'Contract article', document_type: 'article', language: 'en', content: 'Body text.' })
    docId = made.body.data.id
    expect(made.body.data.latest_version?.version_number).toBe(1)
  })

  it('has no packages yet, and checks the document without errors', async () => {
    expect((await asOwner('GET', '/submissions')).body.data).toEqual([])
    const res = await asOwner('POST', '/validate-pre-publication', { document_ids: [docId] })
    expect(res.status).toBe(200)
    expect(validationSchema.parse(res.body.data).is_valid).toBe(true)
  })

  it('cannot be given a document with no saved version: a new document always has its first version', async () => {
    const res = await asOwner('POST', '/documents', { title: 'Empty', document_type: 'article', language: 'en' })
    expect(res.status).toBe(422)
    expect(res.body.error.details).toHaveProperty('content')
  })

  it('refuses a package without a title or an abstract', async () => {
    expect((await asOwner('POST', '/submissions', package_({ title: '' }))).status).toBe(422)
    expect((await asOwner('POST', '/submissions', package_({ abstract: '' }))).status).toBe(422)
  })

  it('passes a document id that is not in the project without saying so (it is dropped, and the check says "no documents")', async () => {
    const res = validationSchema.parse((await asOwner('POST', '/validate-pre-publication', { document_ids: [99999999] })).body.data)
    expect(res.issues.map((i) => i.code)).toEqual(['NO_DOCUMENTS'])
  })

  it('freezes and submits the package: version 1, a checksum, status submitted', async () => {
    const res = await asOwner('POST', '/submissions', package_())
    expect(res.status).toBe(201)
    const s = submissionSchema.parse(res.body.data)
    submissionId = s.id
    expect(s).toMatchObject({ version_number: 1, status: 'submitted' })
    expect(s.package_checksum).toMatch(/^[0-9a-f]{64}$/)
  })

  it('lists the package for the project and reads it back', async () => {
    const list = z.array(submissionSchema).parse((await asOwner('GET', '/submissions')).body.data)
    expect(list.map((x) => x.id)).toContain(submissionId)
    expect(submissionSchema.parse((await asOwner('GET', `/submissions/${submissionId}`)).body.data).title).toBe(`[contract-test] ${stamp}`)
  })

  it('C-29: the check flags a citation to unresolved evidence', async () => {
    const lib = await call('POST', '/library/items', { resource_type: 'external', title: `[contract-test] cited source ${stamp}`, author: 'Author A' }, owner)
    const evidenceId = (await asOwner('POST', '/evidence', { resource_id: lib.body.data.resource_id, captured_text: 'Cited text', locator: 'p. 1' })).body.data.id
    const doc = await asOwner('POST', '/documents', { title: 'Cites it', document_type: 'article', language: 'en', content: 'Draft.' })
    const saved = await asOwner('POST', `/documents/${doc.body.data.id}/versions`, {
      content: 'Cites it.',
      expected_version: 1,
      citations: [{ resource_id: lib.body.data.resource_id, evidence_id: evidenceId, locator: 'p. 1', citation_type: 'direct_quotation', formatted_citation: 'Author A, p. 1' }],
    })
    expect(saved.status).toBe(201)
    expect((await asOwner('PATCH', `/evidence/${evidenceId}`, { state: 'unresolved', state_reason: 'Contract test: not yet settled' })).status).toBe(200)
    const res = validationSchema.parse((await asOwner('POST', '/validate-pre-publication', { document_ids: [doc.body.data.id] })).body.data)
    expect(res.is_valid).toBe(false)
    expect(res.issues.map((i) => i.code)).toContain('UNRESOLVED_EVIDENCE_DEPENDENCY')
  })

  it('C-29: the author’s view of a package does not carry reviewer identities or their notes', async () => {
    const text = JSON.stringify((await asOwner('GET', `/submissions/${submissionId}`)).body.data)
    expect(text).not.toMatch(/reviewer_id|reviewer_notes|"reviewer"|"submitter"/)
  })

  it('C-29: a second package cannot be submitted while one is waiting', async () => {
    const res = await asOwner('POST', '/submissions', package_({ title: `[contract-test] second ${stamp}` }))
    expect(res.status).toBe(409)
  })

  it('C-29: a package says nothing is defaulted: a missing licence or declaration is refused', async () => {
    const { rights_declaration: _r, coi_declared: _c, ...rest } = package_({ title: `[contract-test] third ${stamp}` })
    const res = await asOwner('POST', '/submissions', rest)
    expect(res.status).toBe(422)
  })

  it('cleans up: trashes the project', async () => {
    expect((await call('DELETE', `/projects/${projectId}`, undefined, owner)).status).toBe(200)
  })
})
