import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { envelope, mockMe, renderApp } from '@/test/helpers'
import { mockProjectApis, projectDetail } from '@/test/projectMocks'
import { server } from '@/test/server'

const pg = (n: number) => ({ pagination: { current_page: 1, per_page: 8, total_items: n, total_pages: 1, has_more: false } })
const narrator = (id: number, name: string, over: Record<string, unknown> = {}) => ({ id, name, kunya: null, birthdate: null, deathdate: '197', ...over })

const assertion = (over: Record<string, unknown> = {}) => ({
  id: 1,
  project_id: 12,
  subject_type: 'narrator',
  subject_id: 118,
  subject_name: 'Wakīʿ',
  assertion_claim: 'Died in 197 AH',
  uncertainty_level: 'contested',
  competing_alternatives: [{ claim: 'Died in 196 AH', source: 'Taqrīb' }, 'Died in 198 AH'],
  adjudication_notes: 'Prefer 197.',
  creator: { id: 1, display_name: 'Shilan Rashid', email: 'x@example.org' },
  ...over,
})

function mockDossier(o: { assertions?: Record<string, unknown>[]; assessments?: Record<string, unknown>[]; stops?: Record<string, unknown>[]; viewer?: boolean; criticism?: Record<string, unknown>[] } = {}) {
  const calls = { posted: [] as Record<string, unknown>[], patched: [] as Record<string, unknown>[], deleted: [] as string[], assessed: [] as Record<string, unknown>[], assertionQueries: [] as string[] }
  let assertions = o.assertions ?? [assertion(), assertion({ id: 2, subject_id: 999, assertion_claim: 'About someone else' })]
  mockProjectApis(12, { detail: projectDetail(o.viewer ? { owner_id: 9, memberships: [{ user_id: 1, role: 'viewer', status: 'accepted', user: { id: 1, display_name: 'Shilan Rashid' } }] } : {}) })
  server.use(
    http.get('*/api/v1/corpus/narrators/118', () => HttpResponse.json(envelope(narrator(118, 'Wakīʿ ibn al-Jarrāḥ')))),
    http.get('*/api/v1/corpus/narrators/7', () => HttpResponse.json(envelope(narrator(7, 'Sufyān al-Thawrī')))),
    http.get('*/api/v1/corpus/narrators/118/criticism', () => HttpResponse.json(envelope(o.criticism ?? [{ id: 1, qawl: 'ثقة حافظ عابد', narrator_id: 118, scholar: { id: 5, name: 'Ibn Ḥajar' } }], pg(1)))),
    http.get('*/api/v1/corpus/narrators', () => HttpResponse.json(envelope([narrator(7, 'Sufyān al-Thawrī')], pg(1)))),
    http.get('*/api/v1/geospatial/narrators/118/trajectory', () =>
      HttpResponse.json(envelope({ narrator_id: 118, name: 'Wakīʿ', stops: o.stops ?? [{ place_name_ar: 'الكوفة', place_name_en: 'Kufa', type: 'residence', year_start: 130, year_end: null, is_inferred: true, evidence: null }] })),
    ),
    http.get('*/api/v1/projects/12/assertions', ({ request }) => {
      calls.assertionQueries.push(new URL(request.url).search)
      return HttpResponse.json(envelope(assertions))
    }),
    http.post('*/api/v1/projects/12/assertions', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.posted.push(body)
      assertions = [...assertions, assertion({ id: 3, ...body })]
      return HttpResponse.json(envelope(assertion({ id: 3, ...body })), { status: 201 })
    }),
    http.patch('*/api/v1/projects/12/assertions/:id', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.patched.push(body)
      return HttpResponse.json(envelope(assertion(body)))
    }),
    http.delete('*/api/v1/projects/12/assertions/:id', ({ params }) => {
      calls.deleted.push(String(params.id))
      return HttpResponse.json(envelope(null))
    }),
    http.get('*/api/v1/projects/12/narrator-assessments', () =>
      HttpResponse.json(envelope(o.assessments ?? [{ id: 1, narrator_id: 118, teacher_id: 7, assessment_category: 'weakened_specifically', critic_name: 'Aḥmad', qawl_text: 'Weak from Sufyān', created_at: '2026-10-01T00:00:00Z', creator: { id: 1, display_name: 'Shilan Rashid' } }])),
    ),
    http.post('*/api/v1/projects/12/narrator-assessments', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.assessed.push(body)
      return HttpResponse.json(envelope({ id: 2, ...body }), { status: 201 })
    }),
  )
  return calls
}

const open = () => renderApp('/projects/12/analysis/narrators/118', { signedIn: true })

describe('Narrator dossier', () => {
  it('shows the corpus identity with unknown left neutral, and says nothing is computed', async () => {
    mockMe()
    mockDossier()
    open()
    expect(await screen.findByRole('heading', { level: 1, name: /Wakīʿ ibn al-Jarrāḥ/ })).toBeInTheDocument()
    expect(screen.getByText(/computes no verdicts/)).toBeInTheDocument()
    expect(await screen.findByText('ثقة حافظ عابد')).toBeInTheDocument()
  })

  it('lists only this narrator’s assertions, with alternatives, and no account details', async () => {
    mockMe()
    const calls = mockDossier()
    open()
    const list = await screen.findByRole('list', { name: 'What this project holds about the narrator' })
    expect(within(list).getByText('Died in 197 AH')).toBeInTheDocument()
    expect(within(list).getByText('Died in 196 AH')).toBeInTheDocument()
    expect(within(list).getByText('Died in 198 AH')).toBeInTheDocument()
    expect(within(list).getByText('Contested')).toBeInTheDocument()
    expect(within(list).queryByText('About someone else')).not.toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('x@example.org')
    expect(calls.assertionQueries[0]).toBe('?subject_type=narrator')
  })

  it('adds a claim about this narrator with its alternative', async () => {
    mockMe()
    const calls = mockDossier()
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: 'Add a claim' }))
    const dlg = await screen.findByRole('dialog', { name: 'Add a claim' })
    await user.click(within(dlg).getByRole('button', { name: 'Save claim' }))
    expect(await within(dlg).findByText('Write the claim.')).toBeInTheDocument()
    await user.type(within(dlg).getByLabelText(/^Claim/), 'Born in 129 AH')
    await user.selectOptions(within(dlg).getByLabelText(/^How sure/), 'highly_probable')
    await user.click(within(dlg).getByRole('button', { name: 'Add an alternative' }))
    await user.type(within(dlg).getByLabelText(/^Alternative 1/), 'Born in 128 AH')
    await user.click(within(dlg).getByRole('button', { name: 'Save claim' }))
    await waitFor(() => expect(calls.posted).toHaveLength(1))
    expect(calls.posted[0]).toMatchObject({ subject_type: 'narrator', subject_id: 118, subject_name: 'Wakīʿ ibn al-Jarrāḥ', assertion_claim: 'Born in 129 AH', uncertainty_level: 'highly_probable', competing_alternatives: [{ claim: 'Born in 128 AH', source: '' }] })
  })

  it('edits a claim and deletes one after confirmation', async () => {
    mockMe()
    const calls = mockDossier()
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    const dlg = await screen.findByRole('dialog', { name: 'Edit the claim' })
    await user.clear(within(dlg).getByLabelText(/^Claim/))
    await user.type(within(dlg).getByLabelText(/^Claim/), 'Died in 197 AH in Fayd')
    await user.click(within(dlg).getByRole('button', { name: 'Save claim' }))
    await waitFor(() => expect(calls.patched[0]).toMatchObject({ assertion_claim: 'Died in 197 AH in Fayd' }))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    expect(calls.deleted).toEqual([])
    const confirm = await screen.findByRole('dialog')
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(calls.deleted).toEqual(['1']))
  })

  it('groups assessments by teacher and names the teacher', async () => {
    mockMe()
    mockDossier()
    open()
    const list = await screen.findByRole('list', { name: 'Assessments of reports from Sufyān al-Thawrī' })
    expect(within(list).getByText('Weak specifically from this teacher')).toBeInTheDocument()
    expect(within(list).getByText('Weak from Sufyān')).toBeInTheDocument()
  })

  it('records an assessment only once a teacher is chosen', async () => {
    mockMe()
    const calls = mockDossier()
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: 'Record an assessment' }))
    const dlg = await screen.findByRole('dialog', { name: 'Record an assessment' })
    await user.type(within(dlg).getByLabelText(/^Words of the critic/), 'Sound')
    await user.click(within(dlg).getByRole('button', { name: 'Record assessment' }))
    expect(await within(dlg).findByText('Choose the teacher first.')).toBeInTheDocument()
    expect(calls.assessed).toEqual([])
    await user.type(within(dlg).getByRole('textbox', { name: /Find a narrator by name/ }), 'Sufyān')
    await user.click(within(dlg).getByRole('button', { name: 'Search' }))
    await user.click(await within(dlg).findByRole('button', { name: /Sufyān al-Thawrī/ }))
    await user.click(within(dlg).getByRole('button', { name: 'Record assessment' }))
    await waitFor(() => expect(calls.assessed).toEqual([{ narrator_id: 118, teacher_id: 7, assessment_category: 'sound', qawl_text: 'Sound' }]))
  })

  it('shows places read-only, with a missing year left unknown', async () => {
    mockMe()
    mockDossier({ stops: [{ place_name_ar: 'الكوفة', place_name_en: 'Kufa', type: 'death', is_inferred: false }] })
    open()
    const table = await screen.findByRole('table')
    const row = within(table).getByText('Kufa').closest('tr')!
    expect(within(row).getByText('Death')).toBeInTheDocument()
    expect(within(row).getByText('Stated')).toBeInTheDocument()
    expect(within(row).queryByText(/AH/)).not.toBeInTheDocument()
  })

  it('gives a viewer the dossier without any buttons that change it', async () => {
    mockMe()
    mockDossier({ viewer: true })
    open()
    await screen.findByText('Died in 197 AH')
    for (const name of ['Add a claim', 'Edit', 'Delete', 'Record an assessment']) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
  })

  it('asks for a narrator when the address has none that is valid', async () => {
    mockMe()
    mockDossier()
    renderApp('/projects/12/analysis/narrators/abc', { signedIn: true })
    expect(await screen.findByText('Look a narrator up by name to open their dossier.')).toBeInTheDocument()
  })
})
