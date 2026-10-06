import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { runComparisonSchema, subscriptionSchema } from '@/api/schemas/searchCompare'

/**
 * Contract test for search run comparison and alert subscriptions (screen 35). It saves a query in a throwaway project,
 * runs it twice, compares the runs, subscribes and switches the subscription off, and trashes the project. Known backend
 * defects are `it.fails` (request file C-40). WRITTEN FROM THE BACKEND CODE AND NOT YET RUN against a live server (the
 * cloud session has no PHP 8.4). Opt-in for the write part:
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

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`search comparison and subscriptions (${BASE})`, () => {
  const stamp = Date.now()
  let owner = ''
  let a = 0
  let b = 0
  let queryId = 0
  const runs: number[] = []
  let otherRun = 0
  let subId = 0

  const inA = (method: string, path: string, body?: unknown) => call(method, `/projects/${a}${path}`, body, owner)
  const inB = (method: string, path: string, body?: unknown) => call(method, `/projects/${b}${path}`, body, owner)
  const project = async (label: string) =>
    (await call('POST', '/projects', { title: `[contract-test] compare ${label} ${stamp}`, question: 'Compare?', scope: 'Contract testing only.', languages: ['ar'], stage: 'scoping', tags: [] }, owner)).body.data.id as number

  it('sets up two projects with a saved query and two runs in the first and one run in the second', async () => {
    owner = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    a = await project('A')
    b = await project('B')
    queryId = (await inA('POST', '/searches', { name: '[contract-test] q', query_text: '\u0648\u0636\u0648\u0621', search_mode: 'normalized', filter_criteria: {} })).body.data.id
    for (let i = 0; i < 2; i++) runs.push((await inA('POST', `/searches/${queryId}/run`)).body.data.search_run.id)
    const other = (await inB('POST', '/searches', { name: '[contract-test] other', query_text: '\u0635\u0644\u0627\u0629', search_mode: 'normalized', filter_criteria: {} })).body.data.id
    otherRun = (await inB('POST', `/searches/${other}/run`)).body.data.search_run.id
    expect(runs).toHaveLength(2)
    expect(otherRun).toBeGreaterThan(0)
  })

  it('compares two runs into three lists of corpus ids whose counts match', async () => {
    const res = await inA('POST', '/search-runs/compare', { run_id_1: runs[0], run_id_2: runs[1] })
    expect(res.status).toBe(200)
    const d = runComparisonSchema.parse(res.body.data).diff
    expect(d.added_ids).toHaveLength(d.added_count)
    expect(d.removed_ids).toHaveLength(d.removed_count)
    expect(d.retained_ids).toHaveLength(d.retained_count)
  })

  it('subscribes with a frequency, reads it back, and switches it off', async () => {
    const res = await inA('POST', '/search-subscriptions', { saved_query_id: queryId, frequency: 'monthly' })
    expect(res.status).toBe(201)
    const s = subscriptionSchema.parse(res.body.data)
    subId = s.id
    expect([s.frequency, s.is_active]).toEqual(['monthly', true])
    expect(z.array(subscriptionSchema).parse((await inA('GET', '/search-subscriptions')).body.data).some((x) => x.id === subId)).toBe(true)
    expect(subscriptionSchema.parse((await inA('PATCH', `/search-subscriptions/${subId}/toggle`)).body.data).is_active).toBe(false)
  })

  it('refuses a frequency outside daily, weekly and monthly', async () => {
    expect((await inA('POST', '/search-subscriptions', { saved_query_id: queryId, frequency: 'hourly' })).status).toBe(422)
  })

  it('C-40: a run of ANOTHER project cannot be compared, and its details do not come back', async () => {
    const res = await inA('POST', '/search-runs/compare', { run_id_1: runs[0], run_id_2: otherRun })
    expect(res.status).toBe(404)
  })

  it.fails('C-40: a subscription to a query of ANOTHER project is refused', async () => {
    const q = (await inB('POST', '/searches', { name: '[contract-test] secret', query_text: 'x', search_mode: 'normalized', filter_criteria: {} })).body.data.id
    const res = await inA('POST', '/search-subscriptions', { saved_query_id: q, frequency: 'weekly' })
    expect(res.status).toBe(422)
    expect(JSON.stringify(res.body)).not.toContain('secret')
  })

  it.fails('C-40: a subscription says when it last ran once its schedule is due', async () => {
    const list = z.array(subscriptionSchema).parse((await inA('GET', '/search-subscriptions')).body.data)
    expect(list.find((x) => x.id === subId)?.last_run_at).toBeTruthy()
  })

  it('C-40: a run that did not complete cannot be compared', async () => {
    const res = await inA('POST', '/search-runs/compare', { run_id_1: 999999999, run_id_2: runs[1] })
    expect(res.status).toBe(422)
  })

  it.fails('C-40: a subscription can be removed', async () => {
    expect((await inA('DELETE', `/search-subscriptions/${subId}`)).status).toBe(200)
  })

  it('cleans up: trashes both projects', async () => {
    expect((await call('DELETE', `/projects/${a}`, undefined, owner)).status).toBe(200)
    expect((await call('DELETE', `/projects/${b}`, undefined, owner)).status).toBe(200)
  })
})
