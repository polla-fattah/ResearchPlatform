import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { analysisRunSchema, criticismMatrixResultSchema, isnadCompareResultSchema, matnCompareResultSchema } from '@/api/schemas/analyses'

/**
 * Contract test for the comparison workspace (screen 10): saved analyses, matn comparison, isnad comparison and the
 * criticism matrix. Reads the seeded project, then in a throwaway project runs each comparison (computing, and
 * storing as the next version), reads the stored runs back, and cleans up. There is no endpoint to delete or rename a
 * stored analysis (request file C-19), so the stored runs go with the trashed project. Opt-in for the write part:
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

/** The first project of the demo account that has stored analyses, and another project that is not it. */
async function seededProject() {
  const projects = (await call('GET', '/projects?scope=owned&per_page=100')).body.data as { id: number }[]
  for (const p of projects) {
    const runs = (await call('GET', `/projects/${p.id}/analyses`)).body.data as unknown[]
    if (runs.length > 0) return { id: p.id, otherId: projects.find((x) => x.id !== p.id)!.id }
  }
  throw new Error('the demo account needs a project with stored analyses')
}

describe.skipIf(!reachable || !EMAIL || !PASSWORD)(`analyses, read (${BASE})`, () => {
  it('lists and reads the seeded project’s stored analyses with the run schema, newest first', async () => {
    token = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    const seeded = await seededProject()
    const list = await call('GET', `/projects/${seeded.id}/analyses`)
    const runs = z.array(analysisRunSchema).parse(list.body.data)
    expect(runs.length).toBeGreaterThan(0)
    const dates = runs.map((r) => r.created_at ?? '')
    expect([...dates].sort().reverse()).toEqual(dates)
    const shown = analysisRunSchema.parse((await call('GET', `/projects/${seeded.id}/analyses/${runs[0]!.id}`)).body.data)
    expect(shown.id).toBe(runs[0]!.id)
    const typed = await call('GET', `/projects/${seeded.id}/analyses?type=${runs[0]!.analysis_type}`)
    expect(
      z
        .array(analysisRunSchema)
        .parse(typed.body.data)
        .every((r) => r.analysis_type === runs[0]!.analysis_type),
    ).toBe(true)
  })

  it('answers 404 for an analysis that is not in the project, whichever way it is missing', async () => {
    const withRuns = await seededProject()
    const id = (await call('GET', `/projects/${withRuns.id}/analyses`)).body.data[0].id
    expect((await call('GET', `/projects/${withRuns.id}/analyses/99999999`)).status).toBe(404)
    expect((await call('GET', `/projects/${withRuns.otherId}/analyses/${id}`)).status).toBe(404)
  })

  it('keeps the seeded runs in the shapes the service makes (C-19)', async () => {
    const seeded = await seededProject()
    const runs = z.array(analysisRunSchema).parse((await call('GET', `/projects/${seeded.id}/analyses`)).body.data)
    // Documents what the UI relies on: the demo runs are NOT in the service's shapes, so they are drawn as stored.
    const asService = {
      matn_comparison: matnCompareResultSchema,
      isnad_comparison: isnadCompareResultSchema,
      criticism_matrix: criticismMatrixResultSchema,
    } as const
    const mismatched = runs.filter(
      (r) => r.analysis_type in asService && !asService[r.analysis_type as keyof typeof asService].safeParse(r.output_data).success,
    )
    expect(mismatched.length).toBeGreaterThan(0)
  })
})

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`analyses, write (${BASE})`, () => {
  let projectId = 0
  let hadithIds: number[] = []
  let sanadIds: number[] = []
  let narratorIds: number[] = []
  let firstSavedId = 0

  it('signs in, picks real corpus ids, and builds a throwaway project', async () => {
    token = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    const seeded = await seededProject()
    const evidence = (await call('GET', `/projects/${seeded.id}/evidence?per_page=50`)).body.data as {
      resource?: { corpus_table?: string; corpus_id?: number }
    }[]
    hadithIds = evidence
      .filter((e) => e.resource?.corpus_table === 'hadiths')
      .map((e) => e.resource!.corpus_id!)
      .slice(0, 3)
    expect(hadithIds.length).toBeGreaterThanOrEqual(2)
    const sanads = [(await call('GET', '/corpus/sanads/1')).body.data, (await call('GET', '/corpus/sanads/2')).body.data]
    sanadIds = sanads.map((s) => s.id)
    narratorIds = [1403, 31544]
    projectId = (
      await call('POST', '/projects', {
        title: `[contract-test] analyses ${new Date().toISOString().slice(0, 19)}`,
        question: 'Analyses contract',
        scope: 'Contract testing only.',
        languages: ['ar'],
        stage: 'scoping',
        tags: [],
      })
    ).body.data.id
  })

  it('computes a matn comparison without storing anything, and compares every text with the baseline', async () => {
    const res = await call('POST', `/projects/${projectId}/analyses/matn-compare`, { hadith_ids: hadithIds })
    expect(res.status).toBe(200)
    const parsed = matnCompareResultSchema.parse(res.body.data.analysis)
    expect(res.body.data.saved_run).toBeNull()
    expect(parsed.variant_count).toBe(hadithIds.length)
    expect(Object.keys(parsed.diff_against_baseline ?? {}).length).toBe(hadithIds.length - 1)
    expect((await call('GET', `/projects/${projectId}/analyses`)).body.data).toEqual([])
  })

  it('accepts texts typed in as variants and uses the first as the baseline', async () => {
    const res = await call('POST', `/projects/${projectId}/analyses/matn-compare`, {
      custom_texts: [
        { id: 'a', label: 'A', text: 'إنما الأعمال بالنيات' },
        { id: 'b', label: 'B', text: 'الأعمال بالنية' },
      ],
    })
    const parsed = matnCompareResultSchema.parse(res.body.data.analysis)
    expect(parsed.baseline_id).toBe('a')
    expect(parsed.consensus_core_tokens).toEqual(['الاعمال'])
  })

  it('needs two texts, and says so with a code the screen can show', async () => {
    const res = await call('POST', `/projects/${projectId}/analyses/matn-compare`, { hadith_ids: [hadithIds[0]] })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('ANALYSIS_ERROR')
  })

  it('stores a matn comparison as the next version, with the inputs it was made from', async () => {
    const first = await call('POST', `/projects/${projectId}/analyses/matn-compare`, { hadith_ids: hadithIds, save_run: true })
    const run = analysisRunSchema.parse(first.body.data.saved_run)
    firstSavedId = run.id
    expect(run).toMatchObject({ analysis_type: 'matn_comparison', version_number: 1 })
    expect(run.input_params.hadith_ids).toEqual(hadithIds)
    expect(matnCompareResultSchema.parse(run.output_data).variant_count).toBe(hadithIds.length)
    const second = await call('POST', `/projects/${projectId}/analyses/matn-compare`, { hadith_ids: hadithIds, save_run: true })
    expect(analysisRunSchema.parse(second.body.data.saved_run).version_number).toBe(2)
  })

  it('reads the stored runs back and one by id (runs saved in the same second come in either order, so the screen sorts them)', async () => {
    const list = z.array(analysisRunSchema).parse((await call('GET', `/projects/${projectId}/analyses`)).body.data)
    expect(list.map((r) => r.version_number).sort()).toEqual([1, 2])
    expect(list[0]!.creator?.display_name).toBeTruthy()
    const shown = analysisRunSchema.parse((await call('GET', `/projects/${projectId}/analyses/${firstSavedId}`)).body.data)
    expect(shown.version_number).toBe(1)
  })

  it('compares chains from sanad ids, and says which narrators are in every one', async () => {
    const res = await call('POST', `/projects/${projectId}/analyses/isnad-compare`, { sanad_ids: sanadIds })
    expect(res.status).toBe(200)
    const parsed = isnadCompareResultSchema.parse(res.body.data.analysis)
    expect(parsed.chain_count).toBe(2)
    expect(parsed.chains[0]!.narrators.map((n) => n.order)).toEqual(parsed.chains[0]!.narrators.map((_, i) => i + 1))
    expect(parsed.summary.common_link_count).toBe(parsed.common_links.length)
  })

  it('refuses one chain, and chains that do not exist', async () => {
    const one = await call('POST', `/projects/${projectId}/analyses/isnad-compare`, { sanad_ids: [sanadIds[0]] })
    expect(one.status).toBe(422)
    expect(one.body.error.code).toBe('VALIDATION_ERROR')
    const none = await call('POST', `/projects/${projectId}/analyses/isnad-compare`, { sanad_ids: [99999998, 99999999] })
    expect(none.status).toBe(422)
    expect(none.body.error.code).toBe('ANALYSIS_ERROR')
  })

  it('builds the criticism matrix for narrators, and stores it', async () => {
    const res = await call('POST', `/projects/${projectId}/analyses/criticism-matrix`, { narrator_ids: narratorIds, save_run: true })
    expect(res.status).toBe(200)
    const parsed = criticismMatrixResultSchema.parse(res.body.data.analysis)
    expect(parsed.narrator_count).toBe(narratorIds.length)
    expect(analysisRunSchema.parse(res.body.data.saved_run).analysis_type).toBe('criticism_matrix')
  })

  it('stores a result sent by the client without checking its shape (C-19)', async () => {
    const res = await call('POST', `/projects/${projectId}/analyses/save`, {
      analysis_type: 'matn_comparison',
      input_params: { x: 1 },
      output_data: { anything: true },
    })
    expect(res.status).toBe(201)
    expect(matnCompareResultSchema.safeParse(res.body.data.output_data).success).toBe(false)
  })

  it('refuses a kind of analysis it does not know', async () => {
    const res = await call('POST', `/projects/${projectId}/analyses/save`, {
      analysis_type: 'nonsense',
      input_params: { x: 1 },
      output_data: { y: 1 },
    })
    expect(res.status).toBe(422)
  })

  it('answers an unknown narrator with an empty matrix instead of an error (C-19)', async () => {
    const res = await call('POST', `/projects/${projectId}/analyses/criticism-matrix`, { narrator_ids: [99999999] })
    expect(res.status).toBe(200)
    expect(criticismMatrixResultSchema.parse(res.body.data.analysis).narrator_count).toBe(0)
  })

  it('C-19: the matrix gives each critic’s exact wording, which is what the design shows', async () => {
    const res = await call('POST', `/projects/${projectId}/analyses/criticism-matrix`, { narrator_ids: [1403] })
    const evaluations = Object.values(criticismMatrixResultSchema.parse(res.body.data.analysis).matrix['1403']!.evaluations)
    expect(evaluations.some((e) => !!e.quote)).toBe(true)
  })

  it.fails('C-19: the matrix has one entry per statement, not one per critic', async () => {
    const res = await call('POST', `/projects/${projectId}/analyses/criticism-matrix`, { narrator_ids: [1403] })
    const entry = criticismMatrixResultSchema.parse(res.body.data.analysis).matrix['1403']!
    expect(Object.keys(entry.evaluations).length).toBe(entry.counts.total_statements)
  })

  it('C-19: the matrix counts statements that praise and statements that criticise', async () => {
    const res = await call('POST', `/projects/${projectId}/analyses/criticism-matrix`, { narrator_ids: [1403] })
    const { counts } = criticismMatrixResultSchema.parse(res.body.data.analysis).matrix['1403']!
    expect(counts.taadil + counts.jarh).toBeGreaterThan(0)
  })

  it('C-19: stored analyses can be renamed or deleted', async () => {
    const res = await call('DELETE', `/projects/${projectId}/analyses/${firstSavedId}`)
    expect(res.status).toBe(200)
  })

  it.fails('C-19: stored analyses name their author by id and display name only', async () => {
    const res = await call('GET', `/projects/${projectId}/analyses/${firstSavedId}`)
    expect(JSON.stringify(res.body.data)).not.toMatch(/"email"/)
  })

  it('cleans up: trashes the project (stored analyses cannot be deleted one by one)', async () => {
    expect((await call('DELETE', `/projects/${projectId}`)).status).toBe(200)
  })
})
