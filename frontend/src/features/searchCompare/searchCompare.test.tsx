import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { envelope, mockMe, renderApp } from '@/test/helpers'
import { mockProjectApis, projectDetail } from '@/test/projectMocks'
import { server } from '@/test/server'

const pg = { pagination: { current_page: 1, per_page: 100, total_items: 3, total_pages: 1, has_more: false } }
const query = (id: number, name: string) => ({ id, name, query_text: 'ثلاثا', search_mode: 'normalized', filter_criteria: {} })
const run = (id: number, queryId: number, day: number, over: Record<string, unknown> = {}) => ({ id, saved_query_id: queryId, status: 'completed', match_count: 10 + id, created_at: `2026-09-${String(day).padStart(2, '0')}T09:00:00Z`, corpus_version: 'CS-1', query_version: 1, ...over })
const sub = (over: Record<string, unknown> = {}) => ({ id: 1, project_id: 12, user_id: 1, saved_query_id: 5, frequency: 'weekly', is_active: true, last_run_at: null, last_result_count: null, user: { id: 1, display_name: 'Shilan Rashid', email: 'x@example.org' }, ...over })

function mockCompare(o: { runs?: Record<string, unknown>[]; subs?: Record<string, unknown>[]; viewer?: boolean; diff?: Record<string, number[]> } = {}) {
  const calls = { compared: [] as Record<string, unknown>[], subscribed: [] as Record<string, unknown>[], toggled: [] as string[] }
  let subs = o.subs ?? []
  mockProjectApis(12, { detail: projectDetail(o.viewer ? { owner_id: 9, memberships: [{ user_id: 1, role: 'viewer', status: 'accepted', user: { id: 1, display_name: 'Shilan Rashid' } }] } : {}) })
  const diff = o.diff ?? { added_ids: [101, 102], removed_ids: [103], retained_ids: [104] }
  server.use(
    http.get('*/api/v1/projects/12/searches', () => HttpResponse.json(envelope([query(5, 'Thalāthan'), query(6, 'Other')], pg))),
    http.get('*/api/v1/projects/12/search-runs', () => HttpResponse.json(envelope(o.runs ?? [run(1, 5, 2), run(2, 5, 14), run(3, 5, 20, { status: 'failed' }), run(4, 6, 21)], pg))),
    http.post('*/api/v1/projects/12/search-runs/compare', async ({ request }) => {
      calls.compared.push((await request.json()) as Record<string, unknown>)
      return HttpResponse.json(envelope({ run_1: { id: 1 }, run_2: { id: 2 }, diff: { added_count: diff.added_ids!.length, removed_count: diff.removed_ids!.length, retained_count: diff.retained_ids!.length, ...diff } }))
    }),
    http.get('*/api/v1/corpus/hadiths/:id', ({ params }) => HttpResponse.json(envelope({ id: Number(params.id), matn: `Wording ${params.id}`, clean_matn: 'w' }))),
    http.get('*/api/v1/projects/12/search-subscriptions', () => HttpResponse.json(envelope(subs))),
    http.post('*/api/v1/projects/12/search-subscriptions', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.subscribed.push(body)
      subs = [sub({ frequency: body.frequency, saved_query_id: body.saved_query_id })]
      return HttpResponse.json(envelope(subs[0]), { status: 201 })
    }),
    http.patch('*/api/v1/projects/12/search-subscriptions/:id/toggle', ({ params }) => {
      calls.toggled.push(String(params.id))
      subs = subs.map((s) => (String(s.id) === params.id ? { ...s, is_active: !s.is_active } : s))
      return HttpResponse.json(envelope(subs.find((s) => String(s.id) === params.id)))
    }),
  )
  return calls
}

const open = (qs = '') => renderApp(`/projects/12/searches/compare${qs}`, { signedIn: true })

describe('Search run comparison', () => {
  it('asks for a query first, then for runs, and offers only completed runs of that query', async () => {
    mockMe()
    mockCompare()
    const user = userEvent.setup()
    open()
    expect(await screen.findByText('Choose a saved query.')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText(/^Saved query/), '5')
    const earlier = await screen.findByLabelText(/^Earlier run/)
    expect(within(earlier).getAllByRole('option')).toHaveLength(3)
    expect(screen.getByText('Choose an earlier and a later run.')).toBeInTheDocument()
  })

  it('says a query with fewer than two completed runs cannot be compared', async () => {
    mockMe()
    mockCompare({ runs: [run(1, 5, 2)] })
    open('?query=5')
    expect(await screen.findByText('This query has one completed run. Run it again to compare.')).toBeInTheDocument()
  })

  it('compares the older run with the later one whichever way they are chosen, and shows the three lists', async () => {
    mockMe()
    const calls = mockCompare()
    open('?query=5&a=2&b=1')
    const summary = await screen.findByRole('list', { name: 'Summary' })
    expect(within(summary).getByText('2')).toBeInTheDocument()
    expect(calls.compared).toEqual([{ run_id_1: 1, run_id_2: 2 }])
    const added = await screen.findByRole('list', { name: 'New in the later run' })
    expect(within(added).getByText('REP-000101')).toBeInTheDocument()
    expect(await within(added).findByText('Wording 101')).toBeInTheDocument()
  })

  it('switches between the new, gone and kept lists from the address', async () => {
    mockMe()
    mockCompare()
    const user = userEvent.setup()
    open('?query=5&a=1&b=2')
    await screen.findByRole('list', { name: 'New in the later run' })
    await user.click(screen.getByRole('button', { name: /No longer in the later run/ }))
    const gone = await screen.findByRole('list', { name: 'No longer in the later run' })
    expect(within(gone).getByText('REP-000103')).toBeInTheDocument()
  })

  it('says so when a list is empty', async () => {
    mockMe()
    mockCompare({ diff: { added_ids: [], removed_ids: [], retained_ids: [5] } })
    open('?query=5&a=1&b=2')
    expect(await screen.findByText('No record is new in the later run.')).toBeInTheDocument()
  })

  it('warns when the corpus version or the query changed between the runs, and when it is not known', async () => {
    mockMe()
    mockCompare({ runs: [run(1, 5, 2), run(2, 5, 14, { corpus_version: 'CS-2', query_version: 2 })] })
    open('?query=5&a=1&b=2')
    expect(await screen.findByText(/corpus version changed between the runs \(CS-1 to CS-2\)/)).toBeInTheDocument()
    expect(screen.getByText(/saved query was edited between the two runs/)).toBeInTheDocument()
  })

  it('refuses to compare a run with itself', async () => {
    mockMe()
    const calls = mockCompare()
    open('?query=5&a=1&b=1')
    expect(await screen.findByText('Choose two different runs.')).toBeInTheDocument()
    expect(calls.compared).toEqual([])
  })

  it('says plainly that the server does not rerun or alert yet, and subscribes', async () => {
    mockMe()
    const calls = mockCompare()
    const user = userEvent.setup()
    open('?query=5')
    expect(await screen.findByText(/does not rerun the query or send alerts yet/)).toBeInTheDocument()
    expect(await screen.findByText('You are not subscribed to this query.')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText(/^How often/), 'monthly')
    await user.click(screen.getByRole('button', { name: 'Subscribe' }))
    await waitFor(() => expect(calls.subscribed).toEqual([{ saved_query_id: 5, frequency: 'monthly' }]))
    expect(await screen.findByText('You are subscribed: Monthly.')).toBeInTheDocument()
  })

  it('switches a subscription off and lists others without their account details', async () => {
    mockMe()
    const calls = mockCompare({ subs: [sub(), sub({ id: 2, user_id: 2, user: { id: 2, display_name: 'Aras Kamal', email: 'a@example.org' } })] })
    const user = userEvent.setup()
    open('?query=5')
    await user.click(await screen.findByRole('button', { name: 'Switch off' }))
    await waitFor(() => expect(calls.toggled).toEqual(['1']))
    expect(await screen.findByText('Your subscription is switched off.')).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Others subscribed' })).getByText(/Aras Kamal/)).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('a@example.org')
  })

  it('gives a viewer the comparison and the schedule without controls', async () => {
    mockMe()
    mockCompare({ viewer: true })
    open('?query=5&a=1&b=2')
    await screen.findByRole('list', { name: 'New in the later run' })
    expect(screen.getByText('Subscribing is for members who can edit shared work.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Subscribe' })).not.toBeInTheDocument()
  })

  it('shows an empty state when the project has no saved queries', async () => {
    mockMe()
    mockProjectApis(12)
    server.use(http.get('*/api/v1/projects/12/searches', () => HttpResponse.json(envelope([], pg))), http.get('*/api/v1/projects/12/search-runs', () => HttpResponse.json(envelope([], pg))))
    open()
    expect(await screen.findByRole('heading', { name: 'No saved queries yet' })).toBeInTheDocument()
  })
})
