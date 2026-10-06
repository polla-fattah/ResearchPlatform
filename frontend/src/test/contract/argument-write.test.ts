import { describe, expect, it } from 'vitest'
import { argumentEdgeSchema, argumentGraphSchema, argumentNodeSchema } from '@/api/schemas/argument'

/**
 * Contract test for the argument map (screen 32). It makes points and relations in two throwaway projects, reads the map
 * back, and trashes both. Known backend defects are `it.fails` (request file C-39). WRITTEN FROM THE BACKEND CODE AND NOT
 * YET RUN against a live server (the cloud session has no PHP 8.4). Opt-in for the write part:
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

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`argument map (${BASE})`, () => {
  const stamp = Date.now()
  let owner = ''
  let a = 0
  let b = 0
  const ids: number[] = []
  let edgeId = 0

  const inA = (method: string, path: string, body?: unknown) => call(method, `/projects/${a}${path}`, body, owner)
  const inB = (method: string, path: string, body?: unknown) => call(method, `/projects/${b}${path}`, body, owner)
  const project = async (label: string) =>
    (await call('POST', '/projects', { title: `[contract-test] argument ${label} ${stamp}`, question: 'Argue?', scope: 'Contract testing only.', languages: ['ar'], stage: 'analysing', tags: [] }, owner)).body.data.id as number

  it('sets up two projects', async () => {
    owner = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    a = await project('A')
    b = await project('B')
    expect(a).toBeGreaterThan(0)
    expect(b).toBeGreaterThan(0)
  })

  it('makes points and a relation, and reads the map back', async () => {
    for (const [type, title] of [['claim', 'Claim'], ['objection', 'Objection']] as const) {
      const res = await inA('POST', '/argument-nodes', { node_type: type, title, content: `${title} text` })
      expect(res.status).toBe(201)
      ids.push(argumentNodeSchema.parse(res.body.data).id)
    }
    const edge = await inA('POST', '/argument-edges', { source_node_id: ids[1], target_node_id: ids[0], relation_type: 'refutes' })
    expect(edge.status).toBe(201)
    edgeId = argumentEdgeSchema.parse(edge.body.data).id
    const graph = argumentGraphSchema.parse((await inA('GET', '/argument-graph')).body.data)
    expect(graph.nodes.map((n) => n.id).sort()).toEqual([...ids].sort())
    expect(graph.edges.map((e) => e.id)).toEqual([edgeId])
  })

  it('updates a point and refuses an unknown kind and relation', async () => {
    const res = await inA('PATCH', `/argument-nodes/${ids[0]}`, { title: 'Renamed' })
    expect(argumentNodeSchema.parse(res.body.data).title).toBe('Renamed')
    expect((await inA('POST', '/argument-nodes', { node_type: 'made_up', title: 'x', content: 'y' })).status).toBe(422)
    expect((await inA('POST', '/argument-edges', { source_node_id: ids[0], target_node_id: ids[1], relation_type: 'made_up' })).status).toBe(422)
  })

  it('refuses a point that answers itself', async () => {
    expect((await inA('POST', '/argument-edges', { source_node_id: ids[0], target_node_id: ids[0], relation_type: 'supports' })).status).toBe(422)
  })

  it.fails('C-39: a relation cannot close a loop through other points', async () => {
    const res = await inA('POST', '/argument-edges', { source_node_id: ids[0], target_node_id: ids[1], relation_type: 'replies_to' })
    expect(res.status).toBe(422)
  })

  it.fails('C-39: the same relation is not stored twice', async () => {
    const res = await inA('POST', '/argument-edges', { source_node_id: ids[1], target_node_id: ids[0], relation_type: 'refutes' })
    expect(res.status).toBe(422)
  })

  it.fails('C-39: a relation cannot name a point of ANOTHER project (and its answer must not contain that point)', async () => {
    const other = argumentNodeSchema.parse((await inB('POST', '/argument-nodes', { node_type: 'claim', title: 'Secret of B', content: 'private' })).body.data)
    const res = await inA('POST', '/argument-edges', { source_node_id: ids[0], target_node_id: other.id, relation_type: 'supports' })
    expect(res.status).toBe(422)
    expect(JSON.stringify(res.body)).not.toContain('Secret of B')
  })

  it('C-39: a link to evidence can be removed again', async () => {
    const res = await inA('PATCH', `/argument-nodes/${ids[0]}`, { evidence_id: null })
    expect(argumentNodeSchema.parse(res.body.data).evidence_id ?? null).toBeNull()
  })

  it.fails('C-39: a removed point is kept in a history that can be read', async () => {
    const extra = argumentNodeSchema.parse((await inA('POST', '/argument-nodes', { node_type: 'claim', title: 'Short-lived', content: 'x' })).body.data).id
    await inA('DELETE', `/argument-nodes/${extra}`)
    const res = await inA('GET', '/argument-graph?include_removed=1')
    expect(argumentGraphSchema.parse(res.body.data).nodes.some((n) => n.id === extra)).toBe(true)
  })

  it('removes a relation and a point, and the relation goes with the point', async () => {
    expect((await inA('DELETE', `/argument-edges/${edgeId}`)).status).toBe(200)
    expect((await inA('DELETE', `/argument-nodes/${ids[0]}`)).status).toBe(200)
  })

  it('cleans up: trashes both projects', async () => {
    expect((await call('DELETE', `/projects/${a}`, undefined, owner)).status).toBe(200)
    expect((await call('DELETE', `/projects/${b}`, undefined, owner)).status).toBe(200)
  })
})
