import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { envelope, mockMe, renderApp } from '@/test/helpers'
import { mockProjectApis, projectDetail } from '@/test/projectMocks'
import { server } from '@/test/server'
import { definitionOf, runOrdinal, segments } from './searchModel'

const MATN = 'لا وضوء لمن لم يذكر اسم الله عليه'

const occurrence = (over: Record<string, unknown> = {}) => ({
  id: 88,
  hadith_number: 89,
  page_number: 20,
  volume: null,
  edition: 'الأولى',
  book: { id: 1, title: 'مسند الربيع بن حبيب', edition: 'الأولى', author: { id: 488, name: 'الربيع بن حبيب' } },
  chapter: { id: 28, title: 'باب في أوقات الصلاة' },
  hukm: { id: 6, name: 'Sa7ee7', label: 'صحيح' },
  chain_summary: { narrator_count: 4, first_names: ['ربيع', 'مسلم', 'جابر'], order_uncertain: false },
  ...over,
})

const hit = (over: Record<string, unknown> = {}) => ({
  id: 88,
  full_hadith: null,
  matn: MATN,
  clean_matn: MATN,
  matched_mode: 'normalized',
  why: 'normalized',
  highlights: [{ start: 3, length: 4 }],
  occurrences_count: 1,
  occurrences: [occurrence()],
  ...over,
})

const pg = (n: number, per = 10) => ({
  pagination: { current_page: 1, per_page: per, total_items: n, total_pages: Math.max(1, Math.ceil(n / per)), has_more: false },
})

const savedQuery = (over: Record<string, unknown> = {}) => ({
  id: 31,
  owner_type: 'project',
  owner_id: 12,
  name: 'wuḍūʾ thalāthan',
  query_text: 'وضوء ثلاثا',
  search_mode: 'exact',
  filter_criteria: { hukm_id: 6 },
  created_at: '2026-09-20T10:00:00Z',
  search_runs: [],
  ...over,
})

const run = (over: Record<string, unknown> = {}) => ({
  id: 5,
  saved_query_id: 31,
  corpus_version: 'hadiths_v2.0',
  query_version: 1,
  match_count: 18,
  status: 'completed',
  execution_duration_ms: 12,
  created_at: '2026-10-04T10:00:00Z',
  progress: { scanned_books: 6, total_books: 6, truncated: false, total_available: 18 },
  hits: [],
  ...over,
})

interface Apis {
  hits?: unknown[]
  total?: number
  queries?: unknown[]
  role?: string
  search?: (params: URLSearchParams) => Response | undefined
  runs?: unknown[]
}

function mockSearch(o: Apis = {}) {
  const calls = {
    searches: [] as URLSearchParams[],
    posted: [] as Record<string, unknown>[],
    personal: [] as Record<string, unknown>[],
    resultSets: [] as Record<string, unknown>[],
    bulk: [] as { kind: string; body: Record<string, unknown> }[],
    library: [] as Record<string, unknown>[],
    deleted: [] as string[],
    runPosts: 0,
  }
  mockProjectApis(12, {
    detail: projectDetail({
      memberships: [{ user_id: 1, role: o.role ?? 'owner', status: 'accepted', user: { id: 1, display_name: 'Shilan Rashid' } }],
      ...(o.role && o.role !== 'owner' ? { owner_id: 2 } : {}),
    }),
  })
  const hits = o.hits ?? [hit()]
  server.use(
    http.get('*/api/v1/corpus/search', ({ request }) => {
      const params = new URL(request.url).searchParams
      calls.searches.push(params)
      const custom = o.search?.(params)
      if (custom) return custom
      return HttpResponse.json(envelope(hits, { ...pg(o.total ?? hits.length), counts: { total_reports: o.total ?? hits.length, total_occurrences: 1 } }))
    }),
    http.get('*/api/v1/corpus/hukms', () => HttpResponse.json(envelope([{ id: 6, name: 'Sa7ee7', label: 'صحيح', arabic_name: 'صحيح' }, { id: 4, name: 'Da3eef', label: 'ضعيف', arabic_name: 'ضعيف' }]))),
    http.get('*/api/v1/corpus/narrators', () => HttpResponse.json(envelope([{ id: 9, name: 'جابر بن زيد', deathdate: '93' }], pg(1)))),
    http.get('*/api/v1/projects/12/searches', () => HttpResponse.json(envelope(o.queries ?? [], pg((o.queries ?? []).length)))),
    http.post('*/api/v1/projects/12/searches', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.posted.push(body)
      return HttpResponse.json(envelope(savedQuery({ id: 40, ...body })), { status: 201 })
    }),
    http.post('*/api/v1/saved-searches', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.personal.push(body)
      return HttpResponse.json(envelope(savedQuery({ id: 77, owner_type: 'user', ...body })), { status: 201 })
    }),
    http.delete('*/api/v1/projects/12/searches/:id', ({ params }) => {
      calls.deleted.push(String(params.id))
      return HttpResponse.json(envelope(null))
    }),
    http.post('*/api/v1/projects/12/searches/:id/run', () => {
      calls.runPosts++
      return HttpResponse.json(envelope({ search_run: run({ id: 6, match_count: 18 }), truncated: false, total_available: 18 }))
    }),
    http.get('*/api/v1/projects/12/search-runs', () => HttpResponse.json(envelope(o.runs ?? [run({ id: 5 }), run({ id: 6, created_at: '2026-10-05T10:00:00Z' })], pg(2)))),
    http.post('*/api/v1/projects/12/search-runs/compare', () =>
      HttpResponse.json(envelope({ summary: { common_count: 16, added_count: 2, removed_count: 0 } })),
    ),
    http.get('*/api/v1/projects/12/result-sets', () => HttpResponse.json(envelope([], pg(0)))),
    http.post('*/api/v1/projects/12/result-sets', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.resultSets.push(body)
      return HttpResponse.json(envelope({ id: 7, project_id: 12, name: String(body.name), total_count: Array.isArray(body.items) ? body.items.length : 18 }), { status: 201 })
    }),
    http.get('*/api/v1/projects/12/resources', () => HttpResponse.json(envelope([], pg(0)))),
    http.post('*/api/v1/library/items', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.library.push(body)
      return HttpResponse.json(envelope({ id: 900, resource_id: 500 + calls.library.length, resource: { id: 500, resource_type: 'hadith_reference', title: String(body.title) } }), { status: 201 })
    }),
    http.post('*/api/v1/projects/12/resources/bulk', async ({ request }) => {
      const body = (await request.json()) as { resource_ids: number[] }
      calls.bulk.push({ kind: 'resources', body })
      return HttpResponse.json(envelope({ outcomes: body.resource_ids.map((r) => ({ resource_id: r, outcome: 'added' })), added_count: body.resource_ids.length, skipped_count: 0 }), { status: 201 })
    }),
    http.post('*/api/v1/projects/12/evidence/bulk', async ({ request }) => {
      const body = (await request.json()) as { items: { resource_id: number }[] }
      calls.bulk.push({ kind: 'evidence', body })
      return HttpResponse.json(
        envelope({ outcomes: body.items.map((i, idx) => ({ resource_id: i.resource_id, outcome: idx === 1 ? 'duplicate_skipped' : 'added' })), added_count: 1, skipped_count: 0 }),
        { status: 201 },
      )
    }),
  )
  return calls
}

const search = (text: string) => async () => {
  await userEvent.type(await screen.findByLabelText('Search text'), text)
  await userEvent.click(screen.getByRole('button', { name: 'Search' }))
}

describe('search model', () => {
  it('marks the highlighted part of the original wording and leaves the text unchanged', () => {
    const parts = segments(MATN, [{ start: 3, length: 4 }])
    expect(parts.map((p) => p.text).join('')).toBe(MATN)
    expect(parts.find((p) => p.hit)?.text).toBe('وضوء')
  })

  it('clamps offsets that run past the end and ignores overlapping ones', () => {
    expect(segments('abcdef', [{ start: 4, length: 10 }]).at(-1)).toEqual({ text: 'ef', hit: true })
    expect(segments('abcdef', [{ start: 0, length: 3 }, { start: 1, length: 4 }]).map((s) => s.text)).toEqual(['abc', 'de', 'f'])
    expect(segments('abc', undefined)).toEqual([{ text: 'abc', hit: false }])
  })

  it('numbers runs oldest first within their own saved search', () => {
    const runs = [
      { id: 9, saved_query_id: 31, created_at: '2026-10-05' },
      { id: 4, saved_query_id: 31, created_at: '2026-10-01' },
      { id: 7, saved_query_id: 99, created_at: '2026-10-02' },
    ]
    expect(runOrdinal(runs, 31, 4)).toBe(1)
    expect(runOrdinal(runs, 31, 9)).toBe(2)
    expect(runOrdinal(runs, 31, 123)).toBe(0)
  })

  it('reads a saved query back into the form, showing fts as Normalized', () => {
    const d = definitionOf({ id: 1, name: 'x', query_text: 'وضوء', search_mode: 'fts', filter_criteria: { hukm_id: 6, narrator_label: 'جابر' } })
    expect(d.mode).toBe('normalized')
    expect(d.filters.hukm_id).toBe(6)
    expect(d.filters.narrator_label).toBe('جابر')
    expect(definitionOf({ id: 2, name: 'y', query_text: 'a', filter_criteria: {} }).filters.hukm_id).toBeUndefined()
  })
})

describe('Search workspace', () => {
  it('invites a search before anything has been typed', async () => {
    mockMe()
    const calls = mockSearch()
    renderApp('/projects/12/searches', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'Search the corpus' })).toBeInTheDocument()
    expect(calls.searches).toHaveLength(0)
  })

  it('refuses a one-character search and says why', async () => {
    mockMe()
    const calls = mockSearch()
    renderApp('/projects/12/searches', { signedIn: true })
    await userEvent.type(await screen.findByLabelText('Search text'), 'و')
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByText('Enter at least 2 characters.')).toBeInTheDocument()
    expect(calls.searches).toHaveLength(0)
  })

  it('shows report records with occurrences, highlighted wording, why it matched and counts for both units', async () => {
    mockMe()
    const calls = mockSearch({ total: 1492 })
    renderApp('/projects/12/searches', { signedIn: true })
    await search('وضوء')()

    expect(await screen.findByText(/1,492 report records · 1 occurrence on this page · Mode: Normalized/)).toBeInTheDocument()
    expect(screen.getByText('Report record · REP-000088')).toBeInTheDocument()
    const mark = document.querySelector('mark')
    expect(mark?.textContent).toBe('وضوء')
    expect(screen.getByText('Matched after ignoring diacritics and spelling variants.')).toBeInTheDocument()
    expect(screen.getByText('OCC-000088')).toBeInTheDocument()
    expect(screen.getByText(/Chain: 4 narrators/)).toBeInTheDocument()
    expect(screen.getByText('Ruling: صحيح')).toBeInTheDocument()
    expect(calls.searches[0]?.get('q')).toBe('وضوء')
    expect(calls.searches[0]?.get('mode')).toBe('normalized')
  })

  it('says a chain with no narrators recorded is unknown, not empty', async () => {
    mockMe()
    mockSearch({ hits: [hit({ occurrences: [occurrence({ chain_summary: { narrator_count: 0, first_names: [], order_uncertain: false } })] })] })
    renderApp('/projects/12/searches?q=وضوء', { signedIn: true })
    expect(await screen.findByText('Chain not recorded')).toBeInTheDocument()
  })

  it('sends the mode and the ruling filter to the API', async () => {
    mockMe()
    const calls = mockSearch()
    renderApp('/projects/12/searches?q=وضوء', { signedIn: true })
    await screen.findByText('Report record · REP-000088')
    await userEvent.click(screen.getByRole('radio', { name: 'Exact original text' }))
    await waitFor(() => expect(calls.searches.some((p) => p.get('mode') === 'exact')).toBe(true))
    await userEvent.selectOptions(screen.getByLabelText('Ruling (ḥukm)'), 'صحيح')
    await waitFor(() => expect(calls.searches.some((p) => p.get('hukm_id') === '6')).toBe(true))
    expect(await screen.findByRole('button', { name: 'Remove filter: صحيح' })).toBeInTheDocument()
  })

  it('filters by narrator chosen from a lookup', async () => {
    mockMe()
    const calls = mockSearch()
    renderApp('/projects/12/searches?q=وضوء', { signedIn: true })
    await userEvent.type(await screen.findByLabelText('Narrator in the chain'), 'جابر')
    await userEvent.click(await screen.findByRole('button', { name: /جابر بن زيد/ }))
    await waitFor(() => expect(calls.searches.some((p) => p.get('narrator_id') === '9')).toBe(true))
  })

  it('offers a way out of an empty exact search', async () => {
    mockMe()
    mockSearch({ hits: [] })
    renderApp('/projects/12/searches?q=وضوء&mode=exact', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'No matches in Exact original text mode' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Switch to Normalized' })).toBeInTheDocument()
  })

  it('keeps the query on a failed search and offers a retry', async () => {
    mockMe()
    mockSearch({ search: () => HttpResponse.json({ success: false, error: { message: 'index down' } }, { status: 503 }) })
    renderApp('/projects/12/searches?q=وضوء', { signedIn: true })
    expect(await screen.findByRole('heading', { name: "The search couldn't be completed" })).toBeInTheDocument()
    expect(screen.getByLabelText('Search text')).toHaveValue('وضوء')
    expect(screen.queryByText('index down')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('saves the current text, mode and filters as a project search', async () => {
    mockMe()
    const calls = mockSearch()
    renderApp('/projects/12/searches?q=وضوء&mode=exact&hukm=6', { signedIn: true })
    await screen.findByText('Report record · REP-000088')
    await userEvent.click(screen.getByRole('button', { name: 'Save search' }))
    const dialog = await screen.findByRole('dialog', { name: 'Save search' })
    await userEvent.type(within(dialog).getByLabelText(/Name/), 'wudu exact')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save search' }))
    await waitFor(() => expect(calls.posted).toHaveLength(1))
    expect(calls.posted[0]).toEqual({
      name: 'wudu exact',
      query_text: 'وضوء',
      search_mode: 'exact',
      filter_criteria: { hukm_id: 6 },
    })
    expect(await screen.findByText('Saved as SQ-0040.')).toBeInTheDocument()
  })

  it('opens a saved search into the form and runs it', async () => {
    mockMe()
    const calls = mockSearch({ queries: [savedQuery()] })
    renderApp('/projects/12/searches', { signedIn: true })
    expect(await screen.findByText('SQ-0031')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Open wuḍūʾ thalāthan' }))
    expect(await screen.findByDisplayValue('وضوء ثلاثا')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Exact original text' })).toBeChecked()
    await waitFor(() => expect(calls.searches.some((p) => p.get('hukm_id') === '6' && p.get('mode') === 'exact')).toBe(true))
  })

  it('says a saved search link that is not in this project is not available', async () => {
    mockMe()
    mockSearch({ queries: [savedQuery()] })
    renderApp('/projects/12/searches?query=999', { signedIn: true })
    expect(await screen.findByText("That saved search isn't available")).toBeInTheDocument()
    expect(screen.getByLabelText('Search text')).toHaveValue('')
  })

  it('records a run and shows its code, status and corpus version; "Save all results" freezes the run', async () => {
    mockMe()
    const calls = mockSearch({ queries: [savedQuery({ search_runs: [run({ id: 5 })] })] })
    renderApp('/projects/12/searches?query=31&q=وضوء&mode=exact', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Run and record' }))
    expect(await screen.findByText('Run R-0031-2 completed')).toBeInTheDocument()
    expect(screen.getByText(/18 matches · 12 ms · corpus hadiths_v2.0 · definition v1/)).toBeInTheDocument()
    expect(calls.runPosts).toBe(1)

    await userEvent.click(screen.getByRole('button', { name: 'Save all results' }))
    const dialog = await screen.findByRole('dialog', { name: 'Save as result set' })
    await userEvent.type(within(dialog).getByLabelText(/Name/), 'baseline')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save result set' }))
    await waitFor(() => expect(calls.resultSets).toEqual([{ name: 'baseline', search_run_id: 6, select: 'all' }]))
    expect(await screen.findByText('Saved RS-0007 with 18 members.')).toBeInTheDocument()
  })

  it('turns "Save all results" off for a capped run and says why', async () => {
    mockMe()
    mockSearch({ queries: [savedQuery()] })
    // Registered after mockSearch, so it takes precedence for the run endpoint.
    server.use(
      http.post('*/api/v1/projects/12/searches/:id/run', () =>
        HttpResponse.json(envelope({ search_run: run({ id: 6, match_count: 100, progress: { truncated: true, total_available: 7899 } }) })),
      ),
    )
    renderApp('/projects/12/searches?query=31&q=وضوء', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Run and record' }))
    expect(await screen.findByText(/Only the first 100 of 7,899 matches were recorded/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save all results' })).toBeDisabled()
  })

  it('selects occurrences and saves them as a result set', async () => {
    mockMe()
    const calls = mockSearch()
    renderApp('/projects/12/searches?q=وضوء', { signedIn: true })
    await userEvent.click(await screen.findByRole('checkbox', { name: /Select occurrence in/ }))
    expect(screen.getByText('1 occurrence selected')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save selected as result set' }))
    const dialog = await screen.findByRole('dialog', { name: 'Save as result set' })
    await userEvent.type(within(dialog).getByLabelText(/Name/), 'picked')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save result set' }))
    await waitFor(() => expect(calls.resultSets).toHaveLength(1))
    expect(calls.resultSets[0]).toMatchObject({
      name: 'picked',
      items: [{ resource_type: 'hadith_reference', corpus_id: 88 }],
    })
  })

  it('adds selected occurrences to resources: saves the source, then attaches it', async () => {
    mockMe()
    const calls = mockSearch()
    renderApp('/projects/12/searches?q=وضوء', { signedIn: true })
    await userEvent.click(await screen.findByRole('checkbox', { name: /Select occurrence in/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Add to resources' }))
    const dialog = await screen.findByRole('dialog', { name: /Add to resources/ })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add 1 item' }))
    expect(await within(dialog).findByText('1 added, 0 already there, 0 failed')).toBeInTheDocument()
    expect(calls.library[0]).toMatchObject({ resource_type: 'hadith_reference', corpus_id: 88 })
    expect(calls.bulk).toEqual([{ kind: 'resources', body: { resource_ids: [501] } }])
  })

  it('adds to evidence with the wording and reports a skipped duplicate separately', async () => {
    mockMe()
    const calls = mockSearch({
      hits: [hit({ occurrences: [occurrence(), occurrence({ id: 89, page_number: 21 })], occurrences_count: 2 })],
    })
    renderApp('/projects/12/searches?q=وضوء', { signedIn: true })
    await userEvent.click(await screen.findByRole('checkbox', { name: /Select all occurrences of REP-000088/ }))
    expect(screen.getByText('2 occurrences selected')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add to evidence' }))
    const dialog = await screen.findByRole('dialog', { name: /Add to evidence/ })
    expect(within(dialog).getByText(/New evidence starts as Candidate/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add 2 items' }))
    expect(await within(dialog).findByText('1 added, 1 already there, 0 failed')).toBeInTheDocument()
    const body = calls.bulk[0]!.body as { items: { captured_text: string }[] }
    expect(body.items.map((i) => i.captured_text)).toEqual([MATN, MATN])
  })

  it('shows results to a viewer but no way to add to the project or delete its searches', async () => {
    mockMe()
    mockSearch({ role: 'viewer', queries: [savedQuery()] })
    renderApp('/projects/12/searches?q=وضوء', { signedIn: true })
    expect(await screen.findByText('Report record · REP-000088')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /Select occurrence in/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument()
    expect(screen.getByText(/can read results but not add to it/)).toBeInTheDocument()
  })

  it('lets a viewer save a search for themselves, but not into the project', async () => {
    mockMe()
    const calls = mockSearch({ role: 'viewer' })
    renderApp('/projects/12/searches?q=وضوء&mode=exact', { signedIn: true })
    await screen.findByText('Report record · REP-000088')
    await userEvent.click(screen.getByRole('button', { name: 'Save search' }))
    const dialog = await screen.findByRole('dialog', { name: 'Save search' })
    expect(within(dialog).getByRole('radio', { name: /This project/ })).toBeDisabled()
    expect(within(dialog).getByRole('radio', { name: /Only me/ })).toBeChecked()
    expect(within(dialog).getByText('Your role in this project cannot add to it.')).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText(/Name/), 'mine')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save search' }))
    await waitFor(() => expect(calls.personal).toHaveLength(1))
    expect(calls.posted).toHaveLength(0)
  })

  it('saves for the account only when asked, says where it went, and does not open it as a project search', async () => {
    mockMe()
    const calls = mockSearch()
    const { router } = renderApp('/projects/12/searches?q=وضوء&mode=exact&hukm=6', { signedIn: true })
    await screen.findByText('Report record · REP-000088')
    await userEvent.click(screen.getByRole('button', { name: 'Save search' }))
    const dialog = await screen.findByRole('dialog', { name: 'Save search' })
    expect(within(dialog).getByRole('radio', { name: /This project/ })).toBeChecked()
    await userEvent.click(within(dialog).getByRole('radio', { name: /Only me/ }))
    await userEvent.type(within(dialog).getByLabelText(/Name/), 'wudu for me')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save search' }))
    await waitFor(() => expect(calls.personal).toEqual([{ name: 'wudu for me', query_text: 'وضوء', search_mode: 'exact', filter_criteria: { hukm_id: 6 } }]))
    expect(calls.posted).toHaveLength(0)
    const notice = await screen.findByText(/Saved to your Saved searches as SQ-0077\./)
    expect(within(notice).getByRole('link', { name: 'See Saved searches' })).toHaveAttribute('href', '/searches')
    expect(router.state.location.search).not.toContain('query=')
  })

  it('deletes a saved search only after confirmation', async () => {
    mockMe()
    const calls = mockSearch({ queries: [savedQuery()] })
    renderApp('/projects/12/searches', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Delete wuḍūʾ thalāthan' }))
    const dialog = await screen.findByRole('dialog')
    expect(calls.deleted).toEqual([])
    expect(within(dialog).getByText(/Result sets already saved from its runs keep their members/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete saved search' }))
    await waitFor(() => expect(calls.deleted).toEqual(['31']))
  })

  it('lists a saved search’s runs oldest numbered first and compares two of them', async () => {
    mockMe()
    mockSearch({ queries: [savedQuery()] })
    renderApp('/projects/12/searches?query=31&view=history&q=وضوء', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'Run history · “wuḍūʾ thalāthan”' })).toBeInTheDocument()
    const first = await screen.findByRole('checkbox', { name: 'Select run R-0031-1 to compare' })
    expect(screen.getByRole('checkbox', { name: 'Select run R-0031-2 to compare' })).toBeInTheDocument()
    await userEvent.click(first)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select run R-0031-2 to compare' }))
    await userEvent.click(screen.getByRole('button', { name: 'Compare R-0031-1 with R-0031-2' }))
    expect(await screen.findByText('+2 reports · −0 reports · 16 unchanged')).toBeInTheDocument()
  })
})
