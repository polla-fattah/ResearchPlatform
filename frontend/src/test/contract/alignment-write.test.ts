import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { collateAnswerSchema, collationSchema } from '@/api/schemas/alignment'
import { analysisRunSchema } from '@/api/schemas/analyses'

/**
 * Contract test for matn alignment (screen 26). It aligns three short made-up Arabic texts (no corpus data needed), saves
 * the alignment as a run in a throwaway project, reads it back, and trashes the project. Known backend defects are
 * `it.fails` (request file C-33). WRITTEN FROM THE BACKEND CODE AND NOT YET RUN against a live server (the cloud session
 * has no PHP 8.4). Opt-in for the write part:
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

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`matn alignment (${BASE})`, () => {
  const stamp = Date.now()
  let owner = ''
  let projectId = 0
  let runId = 0

  const asOwner = (method: string, path: string, body?: unknown) => call(method, `/projects/${projectId}${path}`, body, owner)
  const baseline = 'توضأ ثلاثا ثلاثا'
  const variants = [
    { id: 1, label: 'Variant one', text: 'توضأ مرتين' },
    { id: 2, label: 'Variant two', text: 'توضأ ثلاثا ثلاثا ختم' },
  ]

  it('sets up a project', async () => {
    owner = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    projectId = (await call('POST', '/projects', { title: `[contract-test] alignment ${stamp}`, question: 'Align?', scope: 'Contract testing only.', languages: ['ar'], stage: 'analysing', tags: [] }, owner)).body.data.id
    expect(projectId).toBeGreaterThan(0)
  })

  it('aligns each variant against the baseline and answers one alignment per variant, with its slots', async () => {
    const res = await asOwner('POST', '/analyses/collate', { baseline_text: baseline, variants })
    expect(res.status).toBe(200)
    const a = collateAnswerSchema.parse(res.body.data)
    expect(a.saved_run ?? null).toBeNull()
    expect(a.collation.comparisons.map((c) => String(c.variant_id))).toEqual(['1', '2'])
    const second = a.collation.comparisons[1]!.collation
    expect(second.operations.map((o) => o.op)).toEqual(['match', 'match', 'match', 'insertion'])
  })

  it('names the operations the screen reads: match, substitution, insertion, deletion', async () => {
    const res = collationSchema.parse((await asOwner('POST', '/analyses/collate', { baseline_text: baseline, variants })).body.data.collation)
    const ops = new Set(res.comparisons.flatMap((c) => c.collation.operations.map((o) => o.op)))
    expect([...ops].every((o) => ['match', 'substitution', 'insertion', 'deletion'].includes(o))).toBe(true)
    expect(ops.has('substitution')).toBe(true)
  })

  it('refuses a request with no variants or no baseline', async () => {
    expect((await asOwner('POST', '/analyses/collate', { baseline_text: baseline, variants: [] })).status).toBe(422)
    expect((await asOwner('POST', '/analyses/collate', { variants })).status).toBe(422)
  })

  it('stores a saved alignment as the next version and reads it back with the same slots', async () => {
    const res = await asOwner('POST', '/analyses/collate', { baseline_text: baseline, variants, save_run: true })
    expect(res.status).toBe(200)
    const run = analysisRunSchema.parse(res.body.data.saved_run)
    runId = run.id
    expect(run).toMatchObject({ analysis_type: 'sequence_collation', version_number: 1 })
    const again = analysisRunSchema.parse((await asOwner('GET', `/analyses/${runId}`)).body.data)
    expect(collationSchema.parse(again.output_data).comparisons).toHaveLength(2)
    const list = z.array(analysisRunSchema).parse((await asOwner('GET', '/analyses')).body.data)
    expect(list.some((r) => r.id === runId && r.analysis_type === 'sequence_collation')).toBe(true)
  })

  it.fails('C-33: an empty baseline is refused instead of aligning everything as added', async () => {
    const res = await asOwner('POST', '/analyses/collate', { baseline_text: '  ', variants })
    expect(res.status).toBe(422)
  })

  it.fails('C-33: the stored run says which texts were aligned (their ids), not only how many', async () => {
    const run = analysisRunSchema.parse((await asOwner('GET', `/analyses/${runId}`)).body.data)
    expect(JSON.stringify(run.input_params)).toContain('Variant one')
  })

  it.fails('C-33: a very long text is refused before it uses the server’s memory', async () => {
    const long = Array.from({ length: 6000 }, (_, i) => `كلمة${i}`).join(' ')
    const res = await asOwner('POST', '/analyses/collate', { baseline_text: long, variants: [{ id: 1, label: 'long', text: long }] })
    expect(res.status).toBe(422)
  })

  it('cleans up: trashes the project', async () => {
    expect((await call('DELETE', `/projects/${projectId}`, undefined, owner)).status).toBe(200)
  })
})
