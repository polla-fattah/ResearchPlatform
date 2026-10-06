import { describe, expect, it } from 'vitest'
import { graphExportSchema } from '@/api/graphExport'

/**
 * Contract test for the argument-map export and package import (screen 38). It makes a throwaway project with one point,
 * exports its graph, tries a package import and a DOCX request, and trashes what it made. Known backend defects are
 * `it.fails` (request file C-42). WRITTEN FROM THE BACKEND CODE AND NOT YET RUN against a live server (the cloud session
 * has no PHP 8.4). Opt-in:
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

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`export and import (${BASE})`, () => {
  const stamp = Date.now()
  let token = ''
  let projectId = 0
  const made: number[] = []

  const asUser = (method: string, path: string, body?: unknown) => call(method, path, body, token)

  it('sets up a project with two points and a relation', async () => {
    token = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    projectId = (await asUser('POST', '/projects', { title: `[contract-test] exchange ${stamp}`, question: 'Export?', scope: 'Contract testing only.', languages: ['ar'], stage: 'analysing', tags: [] })).body.data.id
    const one = (await asUser('POST', `/projects/${projectId}/argument-nodes`, { node_type: 'claim', title: 'Claim', content: 'Claim text' })).body.data.id
    const two = (await asUser('POST', `/projects/${projectId}/argument-nodes`, { node_type: 'objection', title: 'Objection', content: 'Objection text' })).body.data.id
    expect((await asUser('POST', `/projects/${projectId}/argument-edges`, { source_node_id: two, target_node_id: one, relation_type: 'refutes' })).status).toBe(201)
  })

  it('exports the argument map as a graph with the points and relations and a matching summary', async () => {
    const res = await asUser('GET', `/projects/${projectId}/exports/graph`)
    expect(res.status).toBe(200)
    const g = graphExportSchema.parse(res.body.data)
    expect(g.graph.nodes).toHaveLength(2)
    expect(g.graph.edges).toHaveLength(1)
    expect([g.summary.total_nodes, g.summary.total_edges]).toEqual([2, 1])
  })

  it('answers a package preview with the counts of what the package holds', async () => {
    const res = await asUser('POST', '/projects/import-package', { preview_only: true, package_data: { project: { title: 'Imported study', owner: 'Someone' }, findings: [{ claim: 'x' }], evidence_items: [{}, {}] } })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ original_title: 'Imported study', findings_count: 1, evidence_count: 2 })
  })

  it('refuses a package with no title', async () => {
    expect((await asUser('POST', '/projects/import-package', { package_data: { project: {} } })).status).toBe(422)
  })

  it.fails('C-42: importing a package brings its findings into the new project', async () => {
    const res = await asUser('POST', '/projects/import-package', { new_title: `[contract-test] imported ${stamp}`, package_data: { project: { title: 'Imported study' }, findings: [{ question: 'q', claim: 'A claim', reasoning: 'r' }] } })
    expect(res.status).toBe(201)
    const id = res.body.data.project.id as number
    made.push(id)
    const findings = await asUser('GET', `/projects/${id}/findings`)
    expect(findings.body.data).toHaveLength(1)
  })

  it.fails('C-42: a request for a DOCX export produces a DOCX file, not the same JSON archive', async () => {
    const res = await asUser('POST', '/exports', { scope: 'project', project_ids: [projectId], formats: ['docx'] })
    expect(res.status).toBe(201)
    const job = res.body.data.export_job
    expect(String(job.parts?.[0]?.name ?? '')).toMatch(/\.docx$/)
  })

  it.fails('C-42: the checksum of a project export matches the file that is downloaded later', async () => {
    const job = (await asUser('POST', `/projects/${projectId}/exports`, { format: 'json' })).body.data
    await asUser('POST', `/projects/${projectId}/argument-nodes`, { node_type: 'premise', title: 'Added later', content: 'x' })
    const res = await fetch(`${BASE}/api/v1/projects/${projectId}/exports/${job.id}/download`, { headers: { Authorization: `Bearer ${token}` } })
    const bytes = new TextEncoder().encode(await res.text())
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map((b) => b.toString(16).padStart(2, '0')).join('')
    expect(digest).toBe(job.checksum)
  })

  it.fails('C-42: the graph export can carry the evidence link of a point', async () => {
    const g = graphExportSchema.parse((await asUser('GET', `/projects/${projectId}/exports/graph`)).body.data)
    expect(JSON.stringify(g.graph.nodes[0])).toContain('evidence_id')
  })

  it('cleans up: trashes the projects made', async () => {
    for (const id of [projectId, ...made]) expect((await asUser('DELETE', `/projects/${id}`)).status).toBe(200)
  })
})
