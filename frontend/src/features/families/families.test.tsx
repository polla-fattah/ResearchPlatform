import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { envelope, mockMe, renderApp } from '@/test/helpers'
import { mockProjectApis, projectDetail } from '@/test/projectMocks'
import { server } from '@/test/server'
import { evidenceItem } from '@/test/writingMocks'

const pg = (n: number) => ({ pagination: { current_page: 1, per_page: 100, total_items: n, total_pages: 1, has_more: false } })

const member = (over: Record<string, unknown> = {}) => ({
  id: 1,
  family_id: 5,
  evidence_id: 4,
  corpus_hadith_id: null,
  relationship_type: 'shahid',
  convergence_narrator: null,
  convergence_depth: null,
  scholarly_notes: null,
  created_at: '2026-10-02T09:00:00Z',
  evidence: { id: 4, captured_text: 'تَوَضَّأَ ثَلاَثًا', state: 'included', locator: null },
  ...over,
})
const family = (over: Record<string, unknown> = {}) => ({
  id: 5,
  project_id: 12,
  canonical_title: 'Three-times wuḍūʾ',
  root_companion: 'ʿUthmān',
  core_theme: 'Washing each limb three times.',
  created_at: '2026-10-01T09:00:00Z',
  creator: { id: 1, display_name: 'Shilan Rashid', email: 'x@example.org' },
  members: [member(), member({ id: 2, evidence_id: null, corpus_hadith_id: 90, relationship_type: 'candidate', evidence: null })],
  ...over,
})

function mockFamilies(families: Record<string, unknown>[] = [family()], opts: { hadithMissing?: boolean } = {}) {
  const calls = { created: [] as Record<string, unknown>[], added: [] as Record<string, unknown>[], removed: [] as string[], hadithLooked: [] as string[] }
  mockProjectApis(12, { detail: projectDetail() })
  server.use(
    http.get('*/api/v1/projects/12/families', () => HttpResponse.json(envelope(families))),
    http.post('*/api/v1/projects/12/families', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.created.push(body)
      return HttpResponse.json(envelope(family({ id: 6, canonical_title: body.canonical_title, members: [] })), { status: 201 })
    }),
    http.post('*/api/v1/projects/12/families/5/members', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.added.push(body)
      return HttpResponse.json(envelope(member({ id: 9, ...body })), { status: 201 })
    }),
    http.delete('*/api/v1/projects/12/families/5/members/:id', ({ params }) => {
      calls.removed.push(String(params.id))
      return HttpResponse.json(envelope(null))
    }),
    http.get('*/api/v1/corpus/hadiths/:id', ({ params }) => {
      calls.hadithLooked.push(String(params.id))
      if (opts.hadithMissing) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
      return HttpResponse.json(envelope({ id: Number(params.id), matn: 'm', clean_matn: 'm' }))
    }),
    http.get('*/api/v1/projects/12/evidence', () => HttpResponse.json(envelope([evidenceItem(4), evidenceItem(7)], pg(2)))),
  )
  return calls
}

describe('Hadith families', () => {
  it('says there is no matcher and lists families with their member counts', async () => {
    mockMe()
    mockFamilies()
    renderApp('/projects/12/analysis/families', { signedIn: true })
    expect(await screen.findByText(/no matcher behind this screen/)).toBeInTheDocument()
    const list = await screen.findByRole('list', { name: 'Families' })
    expect(within(list).getByText(/2 members/)).toBeInTheDocument()
  })

  it('shows an empty state with a way to start a family', async () => {
    mockMe()
    mockFamilies([])
    renderApp('/projects/12/analysis/families', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'No families yet' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New family' })).toBeInTheDocument()
  })

  it('opens a family from the address and keeps classified members apart from candidates', async () => {
    mockMe()
    mockFamilies()
    renderApp('/projects/12/analysis/families?family=5', { signedIn: true })
    const article = await screen.findByRole('article', { name: 'Three-times wuḍūʾ' })
    const reviewed = within(article).getByRole('list', { name: 'Classified members' })
    expect(within(reviewed).getByRole('link', { name: 'EV-0004' })).toBeInTheDocument()
    expect(within(reviewed).getByText('Witness (shāhid)')).toBeInTheDocument()
    const candidates = within(article).getByRole('list', { name: 'Candidates' })
    expect(within(candidates).getByText('Candidate (not yet classified)')).toBeInTheDocument()
    expect(article).not.toHaveTextContent('x@example.org')
  })

  it('creates a family and opens it', async () => {
    mockMe()
    const calls = mockFamilies()
    const user = userEvent.setup()
    renderApp('/projects/12/analysis/families', { signedIn: true })
    await user.click(await screen.findByRole('button', { name: 'New family' }))
    const dlg = await screen.findByRole('dialog', { name: 'New family' })
    await user.click(within(dlg).getByRole('button', { name: 'Create family' }))
    expect(await within(dlg).findByText('Give the family a title.')).toBeInTheDocument()
    await user.type(within(dlg).getByLabelText(/^Title/), 'Second family')
    await user.click(within(dlg).getByRole('button', { name: 'Create family' }))
    await waitFor(() => expect(calls.created).toEqual([{ canonical_title: 'Second family' }]))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('adds a report of the corpus only after it is found there', async () => {
    mockMe()
    const calls = mockFamilies()
    const user = userEvent.setup()
    renderApp('/projects/12/analysis/families?family=5', { signedIn: true })
    await user.click(await screen.findByRole('button', { name: 'Add a member' }))
    const dlg = await screen.findByRole('dialog', { name: 'Add a member' })
    await user.click(within(dlg).getByLabelText('A report of the corpus'))
    await user.type(within(dlg).getByLabelText(/^Report number/), '123')
    await user.selectOptions(within(dlg).getByLabelText(/^Relationship/), 'mutabaah_tammah')
    await user.click(within(dlg).getByRole('button', { name: 'Add to family' }))
    await waitFor(() => expect(calls.added).toEqual([{ corpus_hadith_id: 123, relationship_type: 'mutabaah_tammah' }]))
    expect(calls.hadithLooked).toEqual(['123'])
  })

  it('does not add a report the corpus does not have', async () => {
    mockMe()
    const calls = mockFamilies([family()], { hadithMissing: true })
    const user = userEvent.setup()
    renderApp('/projects/12/analysis/families?family=5', { signedIn: true })
    await user.click(await screen.findByRole('button', { name: 'Add a member' }))
    const dlg = await screen.findByRole('dialog', { name: 'Add a member' })
    await user.click(within(dlg).getByLabelText('A report of the corpus'))
    await user.type(within(dlg).getByLabelText(/^Report number/), '999')
    await user.click(within(dlg).getByRole('button', { name: 'Add to family' }))
    expect(await within(dlg).findByText(/The member was not added/)).toBeInTheDocument()
    expect(calls.added).toEqual([])
  })

  it('refuses a report that is already a member without asking the server', async () => {
    mockMe()
    const calls = mockFamilies()
    const user = userEvent.setup()
    renderApp('/projects/12/analysis/families?family=5', { signedIn: true })
    await user.click(await screen.findByRole('button', { name: 'Add a member' }))
    const dlg = await screen.findByRole('dialog', { name: 'Add a member' })
    await user.click(within(dlg).getByLabelText('A report of the corpus'))
    await user.type(within(dlg).getByLabelText(/^Report number/), '90')
    await user.click(within(dlg).getByRole('button', { name: 'Add to family' }))
    expect(await within(dlg).findByText('That is already a member of this family.')).toBeInTheDocument()
    expect(calls.added).toEqual([])
  })

  it('removes a member after confirmation', async () => {
    mockMe()
    const calls = mockFamilies()
    const user = userEvent.setup()
    renderApp('/projects/12/analysis/families?family=5', { signedIn: true })
    await user.click(await screen.findByRole('button', { name: 'Remove EV-0004 from the family' }))
    const dlg = await screen.findByRole('dialog')
    expect(calls.removed).toEqual([])
    await user.click(within(dlg).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(calls.removed).toEqual(['1']))
  })

  it('offers no editing to a viewer', async () => {
    mockMe()
    mockFamilies()
    mockProjectApis(12, { detail: projectDetail({ owner_id: 9, memberships: [{ user_id: 1, role: 'viewer', status: 'accepted', user: { id: 1, display_name: 'Shilan Rashid' } }] }) })
    renderApp('/projects/12/analysis/families?family=5', { signedIn: true })
    await screen.findByRole('article', { name: 'Three-times wuḍūʾ' })
    expect(screen.queryByRole('button', { name: 'Add a member' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Remove / })).not.toBeInTheDocument()
    expect(screen.getByText(/adding to them is for members who can edit/)).toBeInTheDocument()
  })
})
