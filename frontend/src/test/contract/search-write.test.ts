import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { corpusSearchHitSchema } from '@/api/schemas/corpus'
import { libraryItemSchema } from '@/api/schemas/library'
import {
  bulkOutcomeSchema,
  compareSchema,
  resultSetSchema,
  runResultSchema,
  savedQuerySchema,
} from '@/api/schemas/search'
import { pickablesFromHit } from '@/domain/pickable'

/**
 * Write contract test for the search workspace: saves a query in a throwaway project, records two runs,
 * compares them, freezes a result set, bulk-adds an occurrence to resources and evidence, and cleans up
 * (library items deleted, query deleted, project trashed). Opt-in:
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

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`search workspace (${BASE})`, () => {
  let token = ''
  let projectId = 0
  let queryId = 0
  const runIds: number[] = []
  const libraryItems: number[] = []
  let resourceId = 0
  let occurrenceId = 0
  let matn = ''

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

  it('signs in and creates a throwaway project', async () => {
    token = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    const p = await call('POST', '/projects', {
      title: `[contract-test] search ${new Date().toISOString().slice(0, 19)}`,
      question: 'Search contract',
      scope: 'Contract testing only.',
      languages: ['ar'],
      stage: 'scoping',
      tags: [],
    })
    projectId = p.body.data.id
    expect(projectId).toBeGreaterThan(0)
  })

  it('searches the corpus in both modes the design offers, with highlights and counts', async () => {
    for (const mode of ['normalized', 'exact']) {
      const res = await call('GET', `/corpus/search?q=${encodeURIComponent('وضوء')}&mode=${mode}&per_page=3`)
      expect(res.status).toBe(200)
      const hits = z.array(corpusSearchHitSchema).parse(res.body.data)
      expect(hits.length).toBeGreaterThan(0)
      expect(res.body.meta.pagination.total_items).toBeGreaterThan(0)
      expect(res.body.meta.counts.total_reports).toEqual(expect.any(Number))
    }
    const hukm = await call('GET', `/corpus/search?q=${encodeURIComponent('وضوء')}&hukm_id=6&per_page=2`)
    expect(hukm.status).toBe(200)
  })

  it('saves a project search and returns it with its filters', async () => {
    const saved = await call('POST', `/projects/${projectId}/searches`, {
      name: '[contract-test] wudu',
      query_text: 'وضوء',
      search_mode: 'normalized',
      filter_criteria: { hukm_id: 6 },
    })
    expect(saved.status).toBe(201)
    const q = savedQuerySchema.parse(saved.body.data)
    queryId = q.id
    expect(q.filter_criteria?.hukm_id).toBe(6)
  })

  it('records two runs, lists them, and compares them from the stored hits', async () => {
    for (let i = 0; i < 2; i++) {
      const run = await call('POST', `/projects/${projectId}/searches/${queryId}/run`)
      expect(run.status).toBe(200)
      const parsed = runResultSchema.parse(run.body.data)
      expect(['completed', 'partial', 'failed', 'cancelled']).toContain(parsed.search_run.status)
      runIds.push(parsed.search_run.id)
    }
    const list = await call('GET', `/projects/${projectId}/search-runs`)
    expect(list.body.data.map((r: { id: number }) => r.id)).toEqual(expect.arrayContaining(runIds))
    const cmp = await call('POST', `/projects/${projectId}/search-runs/compare`, { run_id_1: runIds[0], run_id_2: runIds[1] })
    expect(cmp.status).toBe(200)
    expect(compareSchema.parse(cmp.body.data).summary.added_count).toBe(0)
  })

  it('applies the saved filters when it runs (DEF-11)', async () => {
    const run = await call('GET', `/projects/${projectId}/search-runs/${runIds[0]}`)
    const filtered = run.body.data.match_count as number
    const all = await call('GET', `/corpus/search?q=${encodeURIComponent('وضوء')}&mode=normalized&per_page=1`)
    // A ruling filter can only narrow the result.
    expect(filtered).toBeLessThanOrEqual(all.body.meta.pagination.total_items)
  })

  it('freezes a result set from selected occurrences, and refuses nothing it should accept', async () => {
    const search = await call('GET', `/corpus/search?q=${encodeURIComponent('وضوء')}&mode=normalized&per_page=5`)
    const hits = z.array(corpusSearchHitSchema).parse(search.body.data)
    const pick = hits.flatMap(pickablesFromHit).find((p) => p.kind === 'occurrence')!
    occurrenceId = pick.corpusId
    matn = pick.text ?? ''
    const set = await call('POST', `/projects/${projectId}/result-sets`, {
      name: '[contract-test] set',
      items: [{ resource_type: 'hadith_reference', corpus_id: occurrenceId, snapshot_data: { matn } }],
    })
    expect(set.status).toBe(201)
    expect(resultSetSchema.parse(set.body.data).total_count).toBe(1)
  })

  it('"Save all results" from a completed run freezes the run hits', async () => {
    const set = await call('POST', `/projects/${projectId}/result-sets`, {
      name: '[contract-test] all',
      search_run_id: runIds[0],
      select: 'all',
    })
    expect(set.status).toBe(201)
  })

  it('adds an occurrence to resources and evidence with a per-item outcome, and reports a repeat', async () => {
    const search = await call('GET', `/corpus/search?q=${encodeURIComponent('وضوء')}&mode=normalized&per_page=5`)
    const hits = z.array(corpusSearchHitSchema).parse(search.body.data)
    const pick = hits.flatMap(pickablesFromHit).find((p) => p.kind === 'occurrence' && p.corpusId === occurrenceId)!
    const saved = await call('POST', '/library/items', { ...pick.save, locator: pick.locator, incomplete_citation_flags: pick.gaps })
    expect([201, 409]).toContain(saved.status)
    if (saved.status === 201) {
      const item = libraryItemSchema.parse(saved.body.data)
      libraryItems.push(item.id)
      resourceId = item.resource_id
    } else {
      resourceId = saved.body.error.details.existing_item.resource_id
    }

    const first = bulkOutcomeSchema.parse((await call('POST', `/projects/${projectId}/resources/bulk`, { resource_ids: [resourceId], run_id: runIds[0] })).body.data)
    expect(first.outcomes[0]?.outcome).toBe('added')
    const again = bulkOutcomeSchema.parse((await call('POST', `/projects/${projectId}/resources/bulk`, { resource_ids: [resourceId] })).body.data)
    expect(again.outcomes[0]?.outcome).toBe('duplicate_skipped')

    const ev = bulkOutcomeSchema.parse(
      (await call('POST', `/projects/${projectId}/evidence/bulk`, { items: [{ resource_id: resourceId, captured_text: matn, locator: pick.locator }], run_id: runIds[0] })).body.data,
    )
    expect(ev.outcomes[0]?.outcome).toBe('added')
    const evAgain = bulkOutcomeSchema.parse(
      (await call('POST', `/projects/${projectId}/evidence/bulk`, { items: [{ resource_id: resourceId, captured_text: matn }] })).body.data,
    )
    expect(evAgain.outcomes[0]?.outcome).toBe('duplicate_skipped')
  })

  // C-15: two occurrences of the SAME report carry the same wording, and evidence is de-duplicated by wording
  // alone, so the second occurrence is skipped as a "duplicate" although it is a different source.
  it('C-15: evidence from two different occurrences of one report is not treated as a duplicate', async () => {
    const search = await call('GET', `/corpus/search?q=${encodeURIComponent('وضوء')}&mode=normalized&per_page=10&page=7`)
    const hits = z.array(corpusSearchHitSchema).parse(search.body.data)
    const multi = hits.find((h) => (h.occurrences?.length ?? 0) >= 2)
    if (!multi) throw new Error('no report with two occurrences on this page')
    const ids: number[] = []
    for (const occ of multi.occurrences!.slice(0, 2)) {
      const p = pickablesFromHit({ ...multi, occurrences: [occ] }).find((x) => x.kind === 'occurrence')!
      const saved = await call('POST', '/library/items', { ...p.save, locator: p.locator, incomplete_citation_flags: p.gaps })
      if (saved.status === 201) libraryItems.push(saved.body.data.id)
      ids.push(saved.status === 201 ? saved.body.data.resource_id : saved.body.error.details.existing_item.resource_id)
    }
    const res = bulkOutcomeSchema.parse(
      (await call('POST', `/projects/${projectId}/evidence/bulk`, { items: ids.map((resource_id) => ({ resource_id, captured_text: multi.matn })) })).body.data,
    )
    expect(res.outcomes.map((o) => o.outcome)).toEqual(['added', 'added'])
  })

  it('cleans up: deletes the saved query and library items, trashes the project', async () => {
    expect((await call('DELETE', `/projects/${projectId}/searches/${queryId}`)).status).toBe(200)
    for (const id of libraryItems) expect((await call('DELETE', `/library/items/${id}`)).status).toBe(200)
    expect((await call('DELETE', `/projects/${projectId}`)).status).toBe(200)
  })
})
