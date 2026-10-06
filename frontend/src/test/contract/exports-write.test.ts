import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import {
  exportJobSchema,
  exportManifestSchema,
  exportPreviewSchema,
  exportQuotaSchema,
} from '@/api/schemas/exports'

/**
 * Write contract test for Downloads (screen 12): exports a throwaway project, checks the job, the manifest and the
 * file, and what the server does on a repeated request. Opt-in:
 *
 *   CONTRACT_WRITE=1 CONTRACT_EMAIL=... CONTRACT_PASSWORD=... npm run test:contract
 *
 * There is no endpoint to delete an export (request file C-17), so each run leaves one finished export behind; it is
 * cancelled at the end so it does not count against the concurrent-export limit.
 */
const BASE = process.env.CONTRACT_BASE_URL ?? 'http://127.0.0.1:8000'
const EMAIL = process.env.CONTRACT_EMAIL
const PASSWORD = process.env.CONTRACT_PASSWORD
const WRITE = process.env.CONTRACT_WRITE === '1'

const reachable = await fetch(`${BASE}/up`).then(
  (r) => r.ok,
  () => false,
)

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`downloads (${BASE})`, () => {
  let token = ''
  let projectId = 0
  let libraryItemId = 0
  let jobId = 0
  const key = `contract-${Date.now()}`
  let first: Record<string, any> = {}

  async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(`${BASE}/api/v1${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    return { status: res.status, body: (text ? JSON.parse(text) : {}) as Record<string, any> }
  }

  it('signs in and builds a throwaway project with one piece of evidence', async () => {
    token = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    projectId = (
      await call('POST', '/projects', {
        title: `[contract-test] downloads ${new Date().toISOString().slice(0, 19)}`,
        question: 'Downloads contract',
        scope: 'Contract testing only.',
        languages: ['ar'],
        stage: 'scoping',
        tags: [],
      })
    ).body.data.id
    const lib = await call('POST', '/library/items', { resource_type: 'external', title: '[contract-test] export source' })
    libraryItemId = lib.body.data.id
    const ev = await call('POST', `/projects/${projectId}/evidence`, { resource_id: lib.body.data.resource_id, captured_text: 'نص تجريبي للتصدير' })
    expect(ev.status).toBe(201)
  })

  it('reports storage use and the concurrent-export limit', async () => {
    const q = exportQuotaSchema.parse((await call('GET', '/exports/quota')).body.data)
    expect(q.limit_bytes).toBeGreaterThan(0)
    expect(q.concurrent_limit).toBeGreaterThan(0)
  })

  it('previews the scope with counts and a size estimate, and hides projects that are not yours', async () => {
    const p = exportPreviewSchema.parse((await call('POST', '/exports/preview', { scope: 'project', project_ids: [projectId] })).body.data)
    expect(p.counts.evidence_items).toBe(1)
    expect(p.estimated_size_bytes).toBeGreaterThan(0)
    expect((await call('POST', '/exports/preview', { scope: 'project', project_ids: [999999] })).status).toBe(404)
  })

  it('creates a package, lists it, and returns a manifest that matches the schema', async () => {
    const res = await call('POST', '/exports', { scope: 'project', project_ids: [projectId], formats: ['zip'] }, { 'Idempotency-Key': key })
    expect(res.status).toBe(201)
    first = res.body.data
    const job = exportJobSchema.parse(first.export_job)
    jobId = job.id
    expect(first.job_id).toBe(jobId)
    expect(job.status).toBe('completed')
    expect(job.parts?.[0]?.status).toBe('ready')
    expect(job.expires_at).toBeTruthy()

    const list = await call('GET', '/exports?per_page=50')
    expect(z.array(exportJobSchema).parse(list.body.data).map((j) => j.id)).toContain(jobId)
    const manifest = exportManifestSchema.parse((await call('GET', `/exports/${jobId}/manifest`)).body.data)
    expect(manifest.files?.some((f) => f.includes(`project_${projectId}`))).toBe(true)
  })

  it('serves the file to its owner as a ZIP, and not to an unknown job', async () => {
    const res = await fetch(`${BASE}/api/v1/exports/${jobId}/parts/1/download`, { headers: { Authorization: `Bearer ${token}` } })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('zip')
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(String.fromCharCode(bytes[0]!, bytes[1]!)).toBe('PK')
    expect((await fetch(`${BASE}/api/v1/exports/999999/parts/1/download`, { headers: { Authorization: `Bearer ${token}` } })).status).toBe(404)
  })

  // C-17: a repeat answers with a different shape, so the client has to accept both.
  it.fails('C-17: a repeated request with the same Idempotency-Key answers in the same shape as the first', async () => {
    const again = await call('POST', '/exports', { scope: 'project', project_ids: [projectId], formats: ['zip'] }, { 'Idempotency-Key': key })
    expect(again.body.data.job_id).toBe(jobId)
  })

  it('a repeated request does not start a second export', async () => {
    const again = await call('POST', '/exports', { scope: 'project', project_ids: [projectId], formats: ['zip'] }, { 'Idempotency-Key': key })
    expect((again.body.data.export_job ?? again.body.data).id).toBe(jobId)
  })

  // C-17: part numbers are not checked; every number returns the same file.
  it.fails('C-17: a part that does not exist is not found', async () => {
    const res = await fetch(`${BASE}/api/v1/exports/${jobId}/parts/2/download`, { headers: { Authorization: `Bearer ${token}` } })
    expect(res.status).toBe(404)
  })

  // C-17: the manifest does not say what is in the package or what was left out.
  it.fails('C-17: the manifest lists object counts and exclusions', async () => {
    const m = (await call('GET', `/exports/${jobId}/manifest`)).body.data
    expect(m.counts).toBeTruthy()
    expect(Array.isArray(m.exclusions)).toBe(true)
  })

  // C-17: a finished export can be "cancelled", which discards it. (Run last: it changes the job.)
  it.fails('C-17: cancelling a finished export is refused', async () => {
    const res = await call('POST', `/exports/${jobId}/cancel`)
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('cleans up: trashes the project and deletes the library item; the export stays (no delete endpoint)', async () => {
    await call('POST', `/exports/${jobId}/cancel`)
    expect((await call('DELETE', `/projects/${projectId}`)).status).toBe(200)
    expect((await call('DELETE', `/library/items/${libraryItemId}`)).status).toBe(200)
  })
})
