import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { analysisRunSchema } from '@/api/schemas/analyses'
import { topologyAnswerSchema } from '@/api/schemas/isnad'

/**
 * Contract test for the isnād graph (screen 27). It builds a graph from three made-up chains with the endpoint's
 * `custom_chains` input (so it needs no corpus data; the screen itself sends `sanad_ids`), saves it as a run in a
 * throwaway project, reads it back, and trashes the project. Known backend defects are `it.fails` (request file C-34).
 * WRITTEN FROM THE BACKEND CODE AND NOT YET RUN against a live server (the cloud session has no PHP 8.4). Opt-in for the
 * write part:
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

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`isnād graph (${BASE})`, () => {
  const stamp = Date.now()
  let owner = ''
  let projectId = 0
  let runId = 0
  const asOwner = (method: string, path: string, body?: unknown) => call(method, `/projects/${projectId}${path}`, body, owner)
  // Each chain is given as recited: the compiler's teacher first, the earliest source last.
  const chains = [
    ['Aḥmad', 'Wakīʿ', 'Sufyān'],
    ['Musaddad', 'Wakīʿ', 'Sufyān'],
    ['al-Ḥumaydī', 'Sufyān'],
  ]

  it('sets up a project', async () => {
    owner = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    projectId = (await call('POST', '/projects', { title: `[contract-test] isnad ${stamp}`, question: 'Graph?', scope: 'Contract testing only.', languages: ['ar'], stage: 'analysing', tags: [] }, owner)).body.data.id
    expect(projectId).toBeGreaterThan(0)
  })

  it('builds the graph: narrators with how many chains pass, links from teacher to student with their counts', async () => {
    const res = await asOwner('POST', '/analyses/isnad-topology', { custom_chains: chains })
    expect(res.status).toBe(200)
    const t = topologyAnswerSchema.parse(res.body.data).topology
    expect(t.total_sanads_analyzed).toBe(3)
    const byName = new Map(t.graph_topology.nodes.map((n) => [n.name, n]))
    expect(byName.get('Sufyān')?.frequency).toBe(3)
    expect(byName.get('Wakīʿ')?.frequency).toBe(2)
    const edge = (a: string, b: string) => t.graph_topology.edges.find((e) => String(e.source) === String(byName.get(a)?.id) && String(e.target) === String(byName.get(b)?.id))
    expect(edge('Sufyān', 'Wakīʿ')?.weight).toBe(2)
    expect(edge('Wakīʿ', 'Aḥmad')?.weight).toBe(1)
  })

  it('refuses a request with no chains and one with a single chain', async () => {
    expect((await asOwner('POST', '/analyses/isnad-topology', {})).status).toBe(422)
    expect((await asOwner('POST', '/analyses/isnad-topology', { custom_chains: [chains[0]] })).status).toBe(422)
  })

  it('stores the graph as the next version and reads it back in the same shape', async () => {
    const res = await asOwner('POST', '/analyses/isnad-topology', { custom_chains: chains, save_run: true })
    const run = analysisRunSchema.parse(res.body.data.saved_run)
    runId = run.id
    expect(run).toMatchObject({ analysis_type: 'isnad_topology', version_number: 1 })
    const again = analysisRunSchema.parse((await asOwner('GET', `/analyses/${runId}`)).body.data)
    expect(z.object({ graph_topology: z.object({ nodes: z.array(z.unknown()) }) }).safeParse(again.output_data).success).toBe(true)
  })

  it.fails('C-34: the answer does not call a rule of thumb a theorem or a verified common link', async () => {
    const text = JSON.stringify((await asOwner('POST', '/analyses/isnad-topology', { custom_chains: chains })).body.data)
    expect(text).not.toMatch(/Theorem|verified_common_link/)
  })

  it.fails('C-34: the earliest source, who is on every chain, is not offered as a common link', async () => {
    const t = topologyAnswerSchema.parse((await asOwner('POST', '/analyses/isnad-topology', { custom_chains: chains })).body.data).topology
    const names = [t.madar_al_isnad, ...(t.partial_common_links ?? [])].filter(Boolean).map((c) => c!.name)
    expect(names).not.toContain('Sufyān')
  })

  it.fails('C-34: the answer returns the chains it used, in the order it read them', async () => {
    const data = (await asOwner('POST', '/analyses/isnad-topology', { custom_chains: chains })).body.data.topology as Record<string, unknown>
    expect(data).toHaveProperty('chains')
  })

  it.fails('C-34: a chain that names the same narrator twice is refused (it would make a loop)', async () => {
    const res = await asOwner('POST', '/analyses/isnad-topology', { custom_chains: [['A', 'B', 'A'], ['C', 'B']] })
    expect(res.status).toBe(422)
  })

  it('cleans up: trashes the project', async () => {
    expect((await call('DELETE', `/projects/${projectId}`, undefined, owner)).status).toBe(200)
  })
})
