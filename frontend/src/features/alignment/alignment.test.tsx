import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { envelope, mockMe, renderApp } from '@/test/helpers'
import { mockProjectApis, projectDetail } from '@/test/projectMocks'
import { server } from '@/test/server'

const report = (id: number, matn: string | null, over: Record<string, unknown> = {}) => ({
  id,
  matn,
  clean_matn: null,
  full_hadith: null,
  references: [{ id: id * 10, hadith_id: id, book_id: 1, book: { id: 1, title: id === 101 ? 'Abū Dāwūd' : 'al-Tirmidhī' }, hadith_number: id === 101 ? 57 : 44 }],
  sanads: [],
  ...over,
})

const op = (o: string, a: string | null, b: string | null, pa: number | null, pb: number | null) => ({ op: o, token_a: a, token_b: b, pos_a: pa, pos_b: pb })

const collation = (variantIds: number[]) => ({
  baseline_text: 'توضا ثلاثا ثلاثا',
  baseline_token_count: 3,
  variant_count: variantIds.length,
  comparisons: variantIds.map((id) => ({
    variant_id: id,
    label: `v${id}`,
    raw_text: 'x',
    collation: {
      alignment_score: 3,
      similarity_percentage: 50,
      summary: { total_aligned_slots: 5, matches: 2, substitutions: 1, additions_ziyadah: 1, omissions_saqt: 1 },
      operations: [op('match', 'توضا', 'توضا', 0, 0), op('substitution', 'ثلاثا', 'مرتين', 1, 1), op('deletion', 'ثلاثا', null, 2, null), op('insertion', null, 'ايضا', null, 2), op('match', 'ختم', 'ختم', 3, 3)],
    },
  })),
})

interface Apis {
  detail?: Record<string, unknown>
  reports?: Record<number, Record<string, unknown>>
  collate?: () => Response | undefined
  runs?: Record<string, unknown>[]
  stored?: Record<string, unknown>
}

function mockAlignment(o: Apis = {}) {
  const reports: Record<number, Record<string, unknown>> = o.reports ?? { 101: report(101, 'توضأ ثلاثا ثلاثا'), 102: report(102, 'توضأ مرتين'), 103: report(103, 'توضأ ثلاثا') }
  const calls = { collated: [] as Record<string, unknown>[], hadith: [] as number[] }
  mockProjectApis(12, { detail: o.detail ?? projectDetail() })
  server.use(
    http.get('*/api/v1/corpus/hadiths/:id', ({ params }) => {
      calls.hadith.push(Number(params.id))
      const r = reports[Number(params.id)]
      return r ? HttpResponse.json(envelope(r)) : HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'x' } }, { status: 404 })
    }),
    http.post('*/api/v1/projects/12/analyses/collate', async ({ request }) => {
      const body = (await request.json()) as Record<string, any>
      calls.collated.push(body)
      const custom = o.collate?.()
      if (custom) return custom
      return HttpResponse.json(envelope({ collation: collation(body.variants.map((v: { id: number }) => v.id)), saved_run: body.save_run ? { id: 21, project_id: 12, analysis_type: 'sequence_collation', input_params: {}, output_data: {}, version_number: 2 } : null }))
    }),
    http.get('*/api/v1/projects/12/analyses', () => HttpResponse.json(envelope(o.runs ?? [], { pagination: { current_page: 1, per_page: 20, total_items: 0, total_pages: 1, has_more: false } }))),
    http.get('*/api/v1/projects/12/analyses/:id', () => HttpResponse.json(envelope(o.stored ?? {}))),
    http.get('*/api/v1/projects/12/evidence', () => HttpResponse.json(envelope([], { pagination: { current_page: 1, per_page: 100, total_items: 0, total_pages: 1, has_more: false } }))),
  )
  return calls
}

const asViewer = { detail: projectDetail({ owner_id: 2, owner: { id: 2, display_name: 'Aras Kamal' }, memberships: [{ user_id: 1, role: 'viewer', status: 'accepted' }] }) }

describe('Matn alignment', () => {
  it('asks for at least two texts first', async () => {
    mockMe()
    mockAlignment()
    renderApp('/projects/12/analysis/matn', { signedIn: true })
    expect(await screen.findByText('Choose at least 2 texts')).toBeInTheDocument()
    expect(screen.getByText(/has not been checked by a researcher/)).toBeInTheDocument()
  })

  it('sends the first text as the baseline and the others as variants, with their wording', async () => {
    mockMe()
    const calls = mockAlignment()
    renderApp('/projects/12/analysis/matn?h=101,102,103', { signedIn: true })
    await screen.findAllByRole('region', { name: /REP-000102/ })
    expect(calls.collated).toEqual([
      {
        baseline_text: 'توضأ ثلاثا ثلاثا',
        variants: [
          { id: 102, label: 'REP-000102 · al-Tirmidhī 44', text: 'توضأ مرتين' },
          { id: 103, label: 'REP-000103 · al-Tirmidhī 44', text: 'توضأ ثلاثا' },
        ],
      },
    ])
  })

  it('shows each text aligned slot by slot with each difference in words and a symbol, and counts from the slots', async () => {
    mockMe()
    mockAlignment()
    renderApp('/projects/12/analysis/matn?h=101,102&diff=0', { signedIn: true })
    const table = await screen.findByRole('table', { name: /Alignment of REP-000102/ })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(5)
    expect(within(rows[1]!).getByText('different word')).toBeInTheDocument()
    expect(within(rows[2]!).getByText('omitted from this text')).toBeInTheDocument()
    expect(within(rows[3]!).getByText('added in this text')).toBeInTheDocument()
    const section = screen.getByRole('region', { name: /REP-000102/ })
    expect(within(section).getByText('2 words the same')).toBeInTheDocument()
    expect(within(section).getByText('1 different word')).toBeInTheDocument()
    expect(within(section).getByText('1 word added')).toBeInTheDocument()
    expect(within(section).getByText('1 word omitted')).toBeInTheDocument()
  })

  it('shows only the differences with one word of context by default, and every word when asked', async () => {
    mockMe()
    mockAlignment()
    renderApp('/projects/12/analysis/matn?h=101,102', { signedIn: true })
    const table = await screen.findByRole('table', { name: /Alignment of REP-000102/ })
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(5)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show only the differences' }))
    expect(screen.getByRole('checkbox', { name: 'Show only the differences' })).not.toBeChecked()
  })

  it('changes the baseline through the address and asks again', async () => {
    mockMe()
    const calls = mockAlignment()
    const { router } = renderApp('/projects/12/analysis/matn?h=101,102,103', { signedIn: true })
    await screen.findAllByRole('region', { name: /REP-000102/ })
    await userEvent.selectOptions(screen.getByLabelText('Compare against'), 'REP-000102 · al-Tirmidhī 44')
    expect(router.state.location.search).toContain('base=102')
    await waitFor(() => expect(calls.collated.at(-1)?.baseline_text).toBe('توضأ مرتين'))
  })

  it('leaves out a report that has no wording, and says so, instead of showing it as entirely omitted', async () => {
    mockMe()
    const calls = mockAlignment({ reports: { 101: report(101, 'توضأ ثلاثا'), 102: report(102, null), 103: report(103, 'توضأ مرتين') } })
    renderApp('/projects/12/analysis/matn?h=101,102,103', { signedIn: true })
    expect(await screen.findByText(/have no wording in the corpus.*102/)).toBeInTheDocument()
    await waitFor(() => expect(calls.collated[0]?.variants).toEqual([{ id: 103, label: 'REP-000103 · al-Tirmidhī 44', text: 'توضأ مرتين' }]))
  })

  it('says a report the corpus does not have was left out', async () => {
    mockMe()
    mockAlignment({ reports: { 101: report(101, 'a b'), 103: report(103, 'a c') } })
    renderApp('/projects/12/analysis/matn?h=101,999,103', { signedIn: true })
    expect(await screen.findByText(/could not be found in the corpus.*999/)).toBeInTheDocument()
  })

  it('shows the server’s failure with a retry, and does not draw an alignment', async () => {
    mockMe()
    mockAlignment({ collate: () => HttpResponse.json({ success: false, error: { code: 'COLLATION_ERROR', message: 'boom' } }, { status: 422 }) })
    renderApp('/projects/12/analysis/matn?h=101,102', { signedIn: true })
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: /Alignment of/ })).not.toBeInTheDocument()
  })

  it('saves an alignment as a run and says which one, for someone who can add shared research', async () => {
    mockMe()
    const calls = mockAlignment()
    renderApp('/projects/12/analysis/matn?h=101,102', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Save this alignment' }))
    await waitFor(() => expect(calls.collated.at(-1)).toMatchObject({ save_run: true }))
    expect(await screen.findByText('Saved as AN-0021 · v2')).toBeInTheDocument()
  })

  it('lets a viewer look but not save', async () => {
    mockMe()
    mockAlignment(asViewer)
    renderApp('/projects/12/analysis/matn?h=101,102', { signedIn: true })
    await screen.findByRole('table', { name: /Alignment of REP-000102/ })
    expect(screen.queryByRole('button', { name: 'Save this alignment' })).not.toBeInTheDocument()
    expect(screen.getByText(/Saving one needs a role that can add shared research/)).toBeInTheDocument()
  })

  it('opens a saved alignment from what the server stored, without computing it again', async () => {
    mockMe()
    const calls = mockAlignment({
      runs: [{ id: 21, project_id: 12, analysis_type: 'sequence_collation', input_params: {}, output_data: collation([102]), version_number: 2, created_at: '2026-10-05T10:00:00Z' }],
      stored: { id: 21, project_id: 12, analysis_type: 'sequence_collation', input_params: {}, output_data: collation([102]), version_number: 2 },
    })
    renderApp('/projects/12/analysis/matn?run=21', { signedIn: true })
    expect(await screen.findByRole('heading', { level: 1, name: 'Matn alignment AN-0021 · v2' })).toBeInTheDocument()
    expect(await screen.findByRole('table', { name: /Alignment of v102/ })).toBeInTheDocument()
    expect(calls.collated).toEqual([])
  })

  it('says a stored analysis in another form is not drawn as an alignment', async () => {
    mockMe()
    mockAlignment({ stored: { id: 22, project_id: 12, analysis_type: 'sequence_collation', input_params: {}, output_data: { something: 'else' }, version_number: 1 } })
    renderApp('/projects/12/analysis/matn?run=22', { signedIn: true })
    expect(await screen.findByText(/not an alignment in the form this screen can draw/)).toBeInTheDocument()
  })

  it('lists saved alignments and says when there are none', async () => {
    mockMe()
    mockAlignment()
    renderApp('/projects/12/analysis/matn', { signedIn: true })
    expect(await screen.findByText('No alignment has been saved in this project.')).toBeInTheDocument()
  })
})
