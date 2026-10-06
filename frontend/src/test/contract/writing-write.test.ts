import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import {
  citePreviewSchema,
  documentSchema,
  draftSchema,
  findingSchema,
  lockSchema,
  versionSchema,
  conflictSchema,
} from '@/api/schemas/writing'

/**
 * Contract test for findings and documents (screen 11). Reads the seeded project, then in a throwaway project:
 * creates a document, autosaves a draft, saves versions (with a refused stale save), restores, previews a citation,
 * links a finding, takes and releases the edit lock, and cleans up. Opt-in for the write part:
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

let token = ''
async function call(method: string, path: string, body?: unknown) {
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
  return { status: res.status, body: (text ? JSON.parse(text) : {}) as Record<string, any> }
}

describe.skipIf(!reachable || !EMAIL || !PASSWORD)(`findings and documents, read (${BASE})`, () => {
  it('reads the seeded project’s documents, a version, the draft and the findings with the schemas', async () => {
    token = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    const projects = await call('GET', '/projects?scope=owned&per_page=100')
    const seeded = projects.body.data.find((p: { id: number; resource_count: number }) => p.resource_count > 0)
    expect(seeded, 'the demo account needs a project with content').toBeTruthy()
    const docs = await call('GET', `/projects/${seeded.id}/documents`)
    const parsedDocs = z.array(documentSchema).parse(docs.body.data)
    const doc = parsedDocs[0]!
    z.array(versionSchema).parse((await call('GET', `/projects/${seeded.id}/documents/${doc.id}/versions`)).body.data)
    draftSchema.parse((await call('GET', `/projects/${seeded.id}/documents/${doc.id}/draft`)).body.data)
    const findings = await call('GET', `/projects/${seeded.id}/findings`)
    expect(z.array(findingSchema).parse(findings.body.data).length).toBeGreaterThan(0)
  })
})

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`findings and documents, write (${BASE})`, () => {
  let projectId = 0
  let libraryItemId = 0
  let resourceId = 0
  let evidenceId = 0
  let docId = 0
  let findingId = 0
  let foreignProjectId = 0
  let foreignDocId = 0
  let foreignEvidenceId = 0

  it('signs in, finds another project’s document and evidence, and builds a throwaway project', async () => {
    token = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    const seeded = (await call('GET', '/projects?scope=owned&per_page=100')).body.data.find((p: { resource_count: number }) => p.resource_count > 0)
    foreignProjectId = seeded.id
    foreignDocId = (await call('GET', `/projects/${foreignProjectId}/documents`)).body.data[0].id
    foreignEvidenceId = (await call('GET', `/projects/${foreignProjectId}/evidence`)).body.data[0].id
    projectId = (
      await call('POST', '/projects', {
        title: `[contract-test] writing ${new Date().toISOString().slice(0, 19)}`,
        question: 'Writing contract',
        scope: 'Contract testing only.',
        languages: ['ar'],
        stage: 'scoping',
        tags: [],
      })
    ).body.data.id
    const lib = await call('POST', '/library/items', { resource_type: 'external', title: '[contract-test] source', author: 'Author A' })
    libraryItemId = lib.body.data.id
    resourceId = lib.body.data.resource_id
    evidenceId = (await call('POST', `/projects/${projectId}/evidence`, { resource_id: resourceId, captured_text: 'نص للاختبار', locator: 'p. 5' })).body.data.id
  })

  it('creates a document with a first version, and reads it back', async () => {
    const res = await call('POST', `/projects/${projectId}/documents`, { title: 'Probe', content: '# One\n\ntext', document_type: 'article', language: 'ckb' })
    expect(res.status).toBe(201)
    const doc = documentSchema.parse(res.body.data)
    docId = doc.id
    expect(doc.latest_version?.version_number).toBe(1)
    const shown = documentSchema.parse((await call('GET', `/projects/${projectId}/documents/${docId}`)).body.data)
    expect(shown.language).toBe('ckb')
  })

  it('autosaves a draft per person and returns it, without making a version', async () => {
    const put = await call('PUT', `/projects/${projectId}/documents/${docId}/draft`, { content: '# One\n\nunsaved', base_version: 1 })
    expect(put.status).toBe(200)
    const draft = draftSchema.parse((await call('GET', `/projects/${projectId}/documents/${docId}/draft`)).body.data)
    expect(draft.draft_content).toBe('# One\n\nunsaved')
    expect(draft.draft_base_version).toBe(1)
    const versions = z.array(versionSchema).parse((await call('GET', `/projects/${projectId}/documents/${docId}/versions`)).body.data)
    expect(versions).toHaveLength(1)
  })

  it('saves a version with its citations, and refuses a stale save with the newer text and its author', async () => {
    const ok = await call('POST', `/projects/${projectId}/documents/${docId}/versions`, {
      content: '# One\n\nv2',
      expected_version: 1,
      change_summary: 'two',
      citations: [{ resource_id: resourceId, evidence_id: evidenceId, locator: 'p. 5', citation_type: 'direct_quotation', formatted_citation: 'Author A, source, p. 5' }],
    })
    expect(ok.status).toBe(201)
    expect(versionSchema.parse(ok.body.data).version_number).toBe(2)
    const stale = await call('POST', `/projects/${projectId}/documents/${docId}/versions`, { content: 'stale', expected_version: 1 })
    expect(stale.status).toBe(409)
    expect(stale.body.error.code).toBe('CONFLICT')
    const conflict = conflictSchema.parse(stale.body.error.details)
    expect(conflict.current_version).toBe(2)
    expect(conflict.current_content).toBe('# One\n\nv2')
  })

  it('restores an old version as a new head version and keeps the history', async () => {
    const res = await call('POST', `/projects/${projectId}/documents/${docId}/versions/1/restore`)
    expect(res.status).toBe(201)
    const restored = versionSchema.parse(res.body.data)
    expect(restored.version_number).toBe(3)
    expect(restored.content).toBe('# One\n\ntext')
    const versions = z.array(versionSchema).parse((await call('GET', `/projects/${projectId}/documents/${docId}/versions`)).body.data)
    expect(versions.map((v) => v.version_number).sort()).toEqual([1, 2, 3])
  })

  it('previews a citation for the project’s own evidence', async () => {
    const res = citePreviewSchema.parse((await call('POST', `/projects/${projectId}/documents/${docId}/cite`, { evidence_id: evidenceId, mode: 'paraphrase' })).body.data)
    expect(res.citation_type).toBe('paraphrase')
    expect(res.formatted_citation).toContain('[contract-test] source')
  })

  it('creates, edits and links a finding to the document; the edit lock is taken and released', async () => {
    const f = await call('POST', `/projects/${projectId}/findings`, { question: 'Q?', claim: 'C', reasoning: 'R', status: 'provisional' })
    expect(f.status).toBe(201)
    findingId = findingSchema.parse(f.body.data).id
    const edited = findingSchema.parse((await call('PATCH', `/projects/${projectId}/findings/${findingId}`, { claim: 'C2', status: 'supported' })).body.data)
    expect(edited.claim).toBe('C2')
    expect(edited.status).toBe('supported')
    const linked = documentSchema.parse((await call('POST', `/projects/${projectId}/documents/${docId}/findings/${findingId}`)).body.data)
    expect(linked.findings?.map((x) => x.id)).toContain(findingId)
    const lock = lockSchema.parse((await call('POST', `/projects/${projectId}/documents/${docId}/lock`)).body.data)
    expect(lock.document_id).toBe(docId)
    expect((await call('POST', `/projects/${projectId}/documents/${docId}/unlock`)).status).toBe(200)
    expect((await call('DELETE', `/projects/${projectId}/documents/${docId}/findings/${findingId}`)).status).toBe(200)
  })

  // ---- C-18: known defects, recorded as expected failures --------------------------------------------------------

  it.fails('C-18: a version cannot be saved without saying which version it is based on', async () => {
    const res = await call('POST', `/projects/${projectId}/documents/${docId}/versions`, { content: 'no base given' })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it.fails('C-18: a finding’s version goes up with each edit, so an edit based on the old version is refused', async () => {
    const before = findingSchema.parse((await call('GET', `/projects/${projectId}/findings/${findingId}`)).body.data)
    await call('PATCH', `/projects/${projectId}/findings/${findingId}`, { claim: 'edited by someone else' })
    const res = await call('PATCH', `/projects/${projectId}/findings/${findingId}`, { claim: 'edited from a stale copy', expected_version: before.version })
    expect(res.status).toBe(409)
  })

  // C-18: the per-person draft is not cleared when a version is committed, so reopening the document offers a draft
  // that is older than the newest version. The editor only restores a draft whose base version is the current one.
  it.fails('C-18: a draft is gone once a version has been committed', async () => {
    await call('PUT', `/projects/${projectId}/documents/${docId}/draft`, { content: 'old draft', base_version: 1 })
    const head = (await call('GET', `/projects/${projectId}/documents/${docId}`)).body.data.latest_version.version_number
    await call('POST', `/projects/${projectId}/documents/${docId}/versions`, { content: 'committed', expected_version: head })
    expect((await call('GET', `/projects/${projectId}/documents/${docId}/draft`)).body.data.draft_content ?? null).toBeNull()
  })

  it.fails('C-18: a document’s versions cannot be read through another project', async () => {
    const res = await call('GET', `/projects/${projectId}/documents/${foreignDocId}/versions/1`)
    expect(res.status).toBe(404)
  })

  it.fails('C-18: a citation cannot be built from another project’s evidence', async () => {
    const res = await call('POST', `/projects/${projectId}/documents/${docId}/cite`, { evidence_id: foreignEvidenceId })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it.fails('C-18: a citation of a source that has an author does not say the author is missing', async () => {
    const res = citePreviewSchema.parse((await call('POST', `/projects/${projectId}/documents/${docId}/cite`, { evidence_id: evidenceId })).body.data)
    expect(res.missing_components).not.toContain('author')
  })

  it.fails('C-18: documents and versions name their author by id and display name only', async () => {
    const res = await call('GET', `/projects/${projectId}/documents/${docId}`)
    expect(JSON.stringify(res.body.data)).not.toMatch(/"email"/)
  })

  it.fails('C-18: a finding can be marked withdrawn', async () => {
    const res = await call('PATCH', `/projects/${projectId}/findings/${findingId}`, { status: 'withdrawn' })
    expect(res.status).toBe(200)
  })

  it('cleans up: deletes the finding and document, the library item, and trashes the project', async () => {
    expect((await call('DELETE', `/projects/${projectId}/findings/${findingId}`)).status).toBe(200)
    expect((await call('DELETE', `/projects/${projectId}/documents/${docId}`)).status).toBe(200)
    expect((await call('DELETE', `/library/items/${libraryItemId}`)).status).toBe(200)
    expect((await call('DELETE', `/projects/${projectId}`)).status).toBe(200)
  })
})
