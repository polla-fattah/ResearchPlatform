import { http, HttpResponse } from 'msw'
import { normalizeArabic } from '@/features/comparison/comparisonModel'
import { envelope } from './helpers'
import { mockProjectApis, projectDetail } from './projectMocks'
import { server } from './server'
import { person } from './writingMocks'

const pg = (n: number, page = 1, perPage = 100) => ({
  pagination: { current_page: page, per_page: perPage, total_items: n, total_pages: Math.max(1, Math.ceil(n / perPage)), has_more: page * perPage < n },
})
const failure = (status: number, code: string, message: string) => HttpResponse.json({ success: false, error: { code, message, details: [] } }, { status })

// ── what the corpus holds in these tests ───────────────────────────────────────────────────────────────────────
export interface Narrator {
  id: number
  name: string
}
export interface Chain {
  id: number
  narrators: Narrator[]
}
export interface Report {
  id: number
  matn: string | null
  book: string
  number: number | null
  chains: Chain[]
  /** More places the report is found, beyond the first. */
  extraPlaces?: number
}

export const report = (id: number, over: Partial<Report> = {}): Report => ({
  id,
  matn: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ',
  book: `Book ${id}`,
  number: id,
  chains: [],
  ...over,
})

const hadithRecord = (r: Report) => ({
  id: r.id,
  full_hadith: r.matn,
  matn: r.matn,
  clean_matn: null,
  references: [
    {
      id: r.id * 10,
      hadith_id: r.id,
      hadith_number: r.number,
      book: { id: r.id, title: r.book },
      sanads: r.chains.map((c) => ({
        id: c.id,
        reference_id: r.id * 10,
        narrator_nodes: c.narrators.map((n, i) => ({ id: c.id * 100 + i, narrator_id: n.id, narrator: { id: n.id, name: n.name } })),
      })),
    },
    ...Array.from({ length: r.extraPlaces ?? 0 }, (_, i) => ({ id: r.id * 10 + i + 1, hadith_id: r.id, hadith_number: null, book: { id: 900 + i, title: 'Other' }, sanads: [] })),
  ],
})

export const narrator = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  name: `Narrator ${id}`,
  kunya: null,
  laqab: null,
  nasab: null,
  shohra: null,
  rutba: null,
  rutba_description: null,
  tabaqah: null,
  tadlis: false,
  has_ikhtilat: false,
  birthdate: null,
  deathdate: null,
  shyookh_count: 0,
  students_count: 0,
  transmissions_count: 0,
  criticisms_count: 0,
  ...over,
})

export interface Statement {
  id: number
  critic: Narrator & { deathdate?: string }
  qawl: string
}

// ── computing like the server ──────────────────────────────────────────────────────────────────────────────────
const tokens = (text: string) => {
  const n = normalizeArabic(text)
  return n === '' ? [] : n.split(' ')
}

function computeMatn(texts: { id: number | string; label?: string; raw: string }[], baselineId?: number) {
  const variants = texts.map((t) => ({ id: t.id, ...(t.label ? { label: t.label } : {}), raw_text: t.raw, normalized_text: normalizeArabic(t.raw), token_count: tokens(t.raw).length, tokens: tokens(t.raw) }))
  const sets = new Map(variants.map((v) => [v.id, new Set(v.tokens)]))
  const shared = [...sets.get(variants[0]!.id)!].filter((w) => variants.every((v) => sets.get(v.id)!.has(w)))
  const base = variants.find((v) => v.id === baselineId) ?? variants[0]!
  const jaccard = (a: Set<string>, b: Set<string>) => {
    const union = new Set([...a, ...b]).size
    return union ? Math.round(([...a].filter((w) => b.has(w)).length / union) * 10000) / 100 : 0
  }
  return {
    analysis_type: 'matn_comparison' as const,
    baseline_id: base.id,
    variant_count: variants.length,
    variants,
    consensus_core_tokens: shared,
    consensus_core_count: shared.length,
    unique_words_summary: Object.fromEntries(
      variants.map((v) => {
        const others = new Set(variants.filter((o) => o.id !== v.id).flatMap((o) => o.tokens))
        const own = [...sets.get(v.id)!].filter((w) => !others.has(w))
        return [String(v.id), { unique_tokens: own, unique_count: own.length }]
      }),
    ),
    similarity_matrix: Object.fromEntries(variants.map((a) => [String(a.id), Object.fromEntries(variants.map((b) => [String(b.id), jaccard(sets.get(a.id)!, sets.get(b.id)!)]))])),
    diff_against_baseline: Object.fromEntries(
      variants
        .filter((v) => v.id !== base.id)
        .map((v) => [String(v.id), { target_id: v.id, additions: v.tokens.filter((w) => !base.tokens.includes(w)), deletions: base.tokens.filter((w) => !v.tokens.includes(w)), overlap_count: v.tokens.filter((w) => base.tokens.includes(w)).length }]),
    ),
  }
}

function computeIsnads(chains: Chain[]) {
  const freq = new Map<number, { n: Narrator; count: number }>()
  for (const c of chains) for (const n of c.narrators) freq.set(n.id, { n, count: (freq.get(n.id)?.count ?? 0) + 1 })
  const link = ({ n, count }: { n: Narrator; count: number }) => ({ id: n.id, name: n.name, tabaqah: null, rutba: null, frequency: count })
  const all = [...freq.values()].filter((f) => f.count === chains.length).map(link)
  const some = [...freq.values()].filter((f) => f.count >= 2 && f.count < chains.length).map(link)
  const minLength = Math.min(...chains.map((c) => c.narrators.length))
  let divergence: number | null = null
  for (let i = 0; i < minLength && divergence === null; i++) {
    if (new Set(chains.map((c) => c.narrators[i]!.id)).size > 1) divergence = i + 1
  }
  return {
    analysis_type: 'isnad_comparison' as const,
    chain_count: chains.length,
    chains: chains.map((c) => ({ sanad_id: c.id, length: c.narrators.length, narrators: c.narrators.map((n, i) => ({ order: i + 1, narrator_id: n.id, name: n.name, tabaqah: null, rutba: null, connector: null })) })),
    common_links: all,
    partial_common_links: some,
    divergence_order: divergence,
    summary: { has_universal_common_link: all.length > 0, common_link_count: all.length, pivotal_narrator: all[0]?.name ?? null },
  }
}

/** The transmission graph the server makes: chains reversed into teacher-to-student order, edges counted, and its rule for candidates. */
function computeTopology(chains: Chain[]) {
  const nodes = new Map<number, { id: number; name: string; tabaqah: null; rutba: null; death_year: null; in_degree: number; out_degree: number; frequency: number; role?: string }>()
  const edges = new Map<string, { source: number; target: number; weight: number }>()
  const paths = chains.map((c) => c.narrators.map((n) => n.id).reverse())
  for (const c of chains) {
    for (const n of c.narrators) {
      const node = nodes.get(n.id) ?? { id: n.id, name: n.name, tabaqah: null, rutba: null, death_year: null, in_degree: 0, out_degree: 0, frequency: 0 }
      node.frequency++
      nodes.set(n.id, node)
    }
  }
  for (const path of paths) {
    for (let i = 0; i < path.length - 1; i++) {
      const key = `${path[i]}->${path[i + 1]}`
      const edge = edges.get(key) ?? { source: path[i]!, target: path[i + 1]!, weight: 0 }
      if (edge.weight === 0) {
        nodes.get(edge.source)!.out_degree++
        nodes.get(edge.target)!.in_degree++
      }
      edge.weight++
      edges.set(key, edge)
    }
  }
  const total = chains.length
  const candidates = [...nodes.values()]
    .map((n) => ({ narrator_id: n.id, name: n.name, out_degree: n.out_degree, in_degree: n.in_degree, chain_coverage: Math.round((n.frequency / total) * 1000) / 10, score: n.out_degree * 2 + (n.frequency / total) * 3 }))
    .filter((c) => c.out_degree >= 2 || (c.chain_coverage >= 70 && total >= 2))
    .sort((a, b) => b.score - a.score)
  for (const [i, c] of candidates.entries()) nodes.get(c.narrator_id)!.role = i === 0 ? 'primary_madar' : 'partial_madar'
  return {
    total_sanads_analyzed: total,
    total_unique_narrators: nodes.size,
    total_transmission_edges: edges.size,
    madar_al_isnad: candidates[0] ?? null,
    partial_common_links: candidates.slice(1),
    graph_topology: { nodes: [...nodes.values()], edges: [...edges.values()], cytoscape: { nodes: [], edges: [] } },
    formal_proof: candidates[0] ? { theorem: 'Topological Convergence Theorem (Madār al-Isnād)', pivot_narrator: candidates[0].name, evidence: 'All lines coalesce.', status: 'verified_common_link' } : null,
  }
}

/** A stored graph in the shape the server makes, for stored-run tests. */
export const topologyResult = (chains: Chain[]) => computeTopology(chains)

function computeMatrix(ids: number[], narrators: Map<number, Narrator>, statements: Map<number, Statement[]>) {
  const scholars = new Map<number, string>()
  const matrix: Record<string, unknown> = {}
  for (const id of ids) {
    const n = narrators.get(id)
    if (!n) continue
    const list = statements.get(id) ?? []
    const evaluations: Record<string, unknown> = {}
    for (const s of list) {
      scholars.set(s.critic.id, s.critic.name)
      evaluations[String(s.critic.id)] = { scholar_id: s.critic.id, scholar_name: s.critic.name, hukm: 'Unspecified', source_book: null, quote: null }
    }
    matrix[String(id)] = { narrator: { id, name: n.name, rutba: null, tabaqah: null }, evaluations, counts: { total_statements: list.length, taadil: 0, jarh: 0 } }
  }
  return {
    analysis_type: 'criticism_matrix' as const,
    narrator_count: Object.keys(matrix).length,
    scholars: [...scholars].map(([id, name]) => ({ id, name })),
    matrix: Object.keys(matrix).length ? matrix : [],
    summary: ids.filter((id) => narrators.has(id)).map((id) => ({ narrator_id: id, name: narrators.get(id)!.name, total_evaluations: (statements.get(id) ?? []).length, taadil_ratio: null })),
  }
}

/** A stored chain comparison or criticism matrix in the shape the server makes, for stored-run tests. */
export const isnadResult = (chains: Chain[]) => computeIsnads(chains)
export const criticismResult = (ids: number[], narrators: Narrator[], statements: Record<number, Statement[]>) =>
  computeMatrix(ids, new Map(narrators.map((n) => [n.id, n])), new Map(Object.entries(statements).map(([id, list]) => [Number(id), list])))

// ── stored runs ───────────────────────────────────────────────────────────────────────────────────────────────
export const runItem = (over: Record<string, unknown> = {}) => ({
  id: 21,
  project_id: 12,
  analysis_type: 'matn_comparison',
  input_params: { hadith_ids: [101, 102] },
  output_data: computeMatn([
    { id: 101, raw: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ' },
    { id: 102, raw: 'الأَعْمَالُ بِالنِّيَّةِ' },
  ]) as unknown,
  version_number: 1,
  created_by: 1,
  created_at: '2026-10-05T10:00:00Z',
  creator: person(),
  ...over,
})

export interface ComparisonApis {
  role?: string
  reports?: Report[]
  /** Evidence items: which reports the project holds as evidence, with their notes. */
  evidence?: { id: number; hadithId: number; annotations?: Record<string, unknown>[] }[]
  runs?: Record<string, unknown>[]
  narrators?: Narrator[]
  statements?: Record<number, Statement[]>
  /** How many statements per page of a narrator's criticism. */
  pageSize?: number
  /** Overrides returning a Response to take over, or undefined to use the default. */
  matn?: () => Response | undefined
  isnad?: () => Response | undefined
  topology?: () => Response | undefined
  criticism?: () => Response | undefined
  searchHits?: { id: number; matn: string; book: string }[]
}

/** Handlers for everything screen 10 uses, with recorders for what was sent. */
export function mockComparison(o: ComparisonApis = {}) {
  const calls = {
    matn: [] as Record<string, unknown>[],
    isnad: [] as Record<string, unknown>[],
    topology: [] as Record<string, unknown>[],
    criticism: [] as Record<string, unknown>[],
    annotations: [] as Record<string, unknown>[],
    criticismPages: [] as number[],
    searches: [] as string[],
    narratorSearches: [] as string[],
  }
  mockProjectApis(12, {
    detail: projectDetail({
      memberships: [{ user_id: 1, role: o.role ?? 'owner', status: 'accepted', user: { id: 1, display_name: 'Shilan Rashid' } }],
      ...(o.role && o.role !== 'owner' ? { owner_id: 2 } : {}),
    }),
  })

  const reports = new Map((o.reports ?? []).map((r) => [r.id, r]))
  const chains = new Map<number, Chain>()
  for (const r of reports.values()) for (const c of r.chains) chains.set(c.id, c)
  const narrators = new Map<number, Narrator>((o.narrators ?? []).map((n) => [n.id, n]))
  for (const c of chains.values()) for (const n of c.narrators) if (!narrators.has(n.id)) narrators.set(n.id, n)
  const statements = new Map<number, Statement[]>(Object.entries(o.statements ?? {}).map(([id, list]) => [Number(id), list]))
  const runs = [...(o.runs ?? [])]
  const pageSize = o.pageSize ?? 20
  const storeRun = (type: string, input: Record<string, unknown>, output: unknown) => {
    const version = runs.filter((r) => r.analysis_type === type).length + 1
    const saved = runItem({ id: 100 + runs.length, analysis_type: type, input_params: input, output_data: output, version_number: version, created_at: '2026-10-06T10:00:00Z' })
    runs.push(saved)
    return saved
  }

  server.use(
    http.get('*/api/v1/projects/12/analyses', () => HttpResponse.json(envelope(runs))),
    http.get('*/api/v1/projects/12/analyses/:id', ({ params }) => {
      const found = runs.find((r) => r.id === Number(params.id))
      return found ? HttpResponse.json(envelope(found)) : failure(404, 'NOT_FOUND', 'No query results for model [App\\Models\\AnalysisRun]')
    }),

    http.post('*/api/v1/projects/12/analyses/matn-compare', async ({ request }) => {
      const body = (await request.json()) as { hadith_ids: number[]; baseline_id?: number; save_run?: boolean }
      calls.matn.push(body)
      const custom = o.matn?.()
      if (custom) return custom
      const texts = body.hadith_ids.flatMap((id) => (reports.has(id) ? [{ id, raw: reports.get(id)!.matn ?? '' }] : []))
      if (texts.length < 2) return failure(422, 'ANALYSIS_ERROR', 'At least two texts or hadith variants are required for comparison.')
      const analysis = computeMatn(texts, body.baseline_id)
      const saved = body.save_run ? storeRun('matn_comparison', { hadith_ids: body.hadith_ids, baseline_id: body.baseline_id ?? null }, analysis) : null
      return HttpResponse.json(envelope({ analysis, saved_run: saved }))
    }),
    http.post('*/api/v1/projects/12/analyses/isnad-compare', async ({ request }) => {
      const body = (await request.json()) as { sanad_ids: number[]; save_run?: boolean }
      calls.isnad.push(body)
      const custom = o.isnad?.()
      if (custom) return custom
      const found = body.sanad_ids.flatMap((id) => (chains.has(id) ? [chains.get(id)!] : []))
      if (found.length < 2) return failure(422, 'ANALYSIS_ERROR', 'Could not find at least two valid sanads with narrator chains.')
      const analysis = computeIsnads(found)
      const saved = body.save_run ? storeRun('isnad_comparison', { sanad_ids: body.sanad_ids }, analysis) : null
      return HttpResponse.json(envelope({ analysis, saved_run: saved }))
    }),
    http.post('*/api/v1/projects/12/analyses/isnad-topology', async ({ request }) => {
      const body = (await request.json()) as { sanad_ids: number[]; save_run?: boolean }
      calls.topology.push(body)
      const custom = o.topology?.()
      if (custom) return custom
      const found = body.sanad_ids.flatMap((id) => (chains.has(id) ? [chains.get(id)!] : []))
      const topology = computeTopology(found)
      const saved = body.save_run ? storeRun('isnad_topology', { sanad_ids: body.sanad_ids, custom_chains_count: 0 }, topology) : null
      return HttpResponse.json(envelope({ topology, saved_run: saved }))
    }),
    http.post('*/api/v1/projects/12/analyses/criticism-matrix', async ({ request }) => {
      const body = (await request.json()) as { narrator_ids: number[]; save_run?: boolean }
      calls.criticism.push(body)
      const custom = o.criticism?.()
      if (custom) return custom
      const analysis = computeMatrix(body.narrator_ids, narrators, statements)
      const saved = body.save_run ? storeRun('criticism_matrix', { narrator_ids: body.narrator_ids, scholar_ids: [] }, analysis) : null
      return HttpResponse.json(envelope({ analysis, saved_run: saved }))
    }),

    http.get('*/api/v1/corpus/hadiths/:id', ({ params }) => {
      const found = reports.get(Number(params.id))
      return found ? HttpResponse.json(envelope(hadithRecord(found))) : failure(404, 'NOT_FOUND', 'No query results for model [Hadith]')
    }),
    http.get('*/api/v1/corpus/search', ({ request }) => {
      calls.searches.push(new URL(request.url).searchParams.get('q') ?? '')
      const hits = (o.searchHits ?? []).map((h) => ({
        id: h.id,
        full_hadith: h.matn,
        matn: h.matn,
        clean_matn: null,
        occurrences: [{ id: h.id * 10, book: { id: 1, title: h.book } }],
      }))
      return HttpResponse.json(envelope(hits, pg(hits.length)))
    }),
    http.get('*/api/v1/corpus/narrators', ({ request }) => {
      const q = new URL(request.url).searchParams.get('q') ?? ''
      calls.narratorSearches.push(q)
      const found = [...narrators.values()].filter((n) => n.name.includes(q)).map((n) => narrator(n.id, { name: n.name }))
      return HttpResponse.json(envelope(found, pg(found.length)))
    }),
    http.get('*/api/v1/corpus/narrators/:id/criticism', ({ params, request }) => {
      const page = Number(new URL(request.url).searchParams.get('page') ?? 1)
      calls.criticismPages.push(page)
      const list = statements.get(Number(params.id)) ?? []
      const slice = list.slice((page - 1) * pageSize, page * pageSize)
      return HttpResponse.json(
        envelope(
          slice.map((s) => ({ id: s.id, qawl: s.qawl, narrator_id: Number(params.id), scholar: narrator(s.critic.id, { name: s.critic.name, deathdate: s.critic.deathdate ?? null }) })),
          pg(list.length, page, pageSize),
        ),
      )
    }),
    http.get('*/api/v1/corpus/narrators/:id/:kind', ({ params }) => {
      if (params.kind !== 'teachers' && params.kind !== 'students') return failure(404, 'NOT_FOUND', 'no')
      const n = narrators.get(Number(params.id))
      const list = n && params.kind === 'teachers' ? [narrator(900, { name: 'Teacher One' }), narrator(901, { name: 'Teacher Two' })] : n ? [narrator(950, { name: 'Student One' })] : []
      return HttpResponse.json(envelope(list, pg(list.length)))
    }),
    http.get('*/api/v1/corpus/narrators/:id', ({ params }) => {
      const found = narrators.get(Number(params.id))
      if (!found) return failure(404, 'NOT_FOUND', 'No query results for model [Narrator]')
      const extra = (o.narrators ?? []).find((n) => n.id === found.id) as Record<string, unknown> | undefined
      return HttpResponse.json(envelope(narrator(found.id, { shyookh_count: 2, students_count: 1, transmissions_count: 846, ...extra })))
    }),

    http.get('*/api/v1/projects/12/evidence', () => {
      const items = (o.evidence ?? []).map((e) => evidenceFor(e.id, e.hadithId, reports.get(e.hadithId)))
      return HttpResponse.json(envelope(items, pg(items.length)))
    }),
    http.get('*/api/v1/projects/12/evidence/:id', ({ params }) => {
      const e = (o.evidence ?? []).find((x) => x.id === Number(params.id))
      return e ? HttpResponse.json(envelope({ ...evidenceFor(e.id, e.hadithId, reports.get(e.hadithId)), annotations: e.annotations ?? [] })) : failure(404, 'NOT_FOUND', 'no')
    }),
    http.post('*/api/v1/projects/12/evidence/:id/annotations', async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.annotations.push({ evidenceId: Number(params.id), ...body })
      const note = { id: 500 + calls.annotations.length, author_id: 1, annotation_kind: body.annotation_kind, visibility: body.visibility, body: body.body, author: { id: 1, display_name: 'Shilan Rashid' } }
      const e = (o.evidence ?? []).find((x) => x.id === Number(params.id))
      if (e) e.annotations = [...(e.annotations ?? []), note]
      return HttpResponse.json(envelope(note), { status: 201 })
    }),
  )
  return { calls, runs }
}

const evidenceFor = (id: number, hadithId: number, r: Report | undefined) => ({
  id,
  project_id: 12,
  resource_id: 70 + id,
  captured_text: r?.matn ?? '',
  locator: null,
  state: 'included',
  resource: { id: 70 + id, resource_type: 'corpus_hadith', corpus_table: 'hadiths', corpus_id: hadithId, title: r?.book ?? '' },
  collector: person(),
})
