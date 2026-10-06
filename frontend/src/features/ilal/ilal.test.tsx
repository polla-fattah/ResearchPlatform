import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { envelope, mockMe, renderApp } from '@/test/helpers'
import { mockProjectApis, projectDetail } from '@/test/projectMocks'
import { server } from '@/test/server'

const kase = (over: Record<string, unknown> = {}) => ({
  id: 3,
  project_id: 12,
  title: 'Does the addition belong to the Wakīʿ route only?',
  discrepancy_category: 'ziyadah_thiqah',
  competing_variants: [
    { name: 'Version A', matn: 'مرة', chain: 'A → B' },
    { name: 'Version B', matn: 'مرتين' },
  ],
  critics_judgments: [{ critic: 'al-Dāraquṭnī', verdict: 'Prefers A', source: 'al-ʿIlal 1/42', favours: 'Version A' }],
  preferred_version: null,
  status: 'under_investigation',
  resolution_notes: null,
  created_at: '2026-10-01T09:00:00Z',
  updated_at: '2026-10-01T09:00:00Z',
  creator: { id: 1, display_name: 'Shilan Rashid', email: 'x@example.org' },
  ...over,
})

function mockCases(cases: Record<string, unknown>[] = [kase()], viewer = false) {
  const calls = { created: [] as Record<string, unknown>[], patched: [] as Record<string, unknown>[] }
  let current = cases
  mockProjectApis(12, {
    detail: projectDetail(viewer ? { owner_id: 9, memberships: [{ user_id: 1, role: 'viewer', status: 'accepted', user: { id: 1, display_name: 'Shilan Rashid' } }] } : {}),
  })
  server.use(
    http.get('*/api/v1/projects/12/ilal-cases', () => HttpResponse.json(envelope(current))),
    http.get('*/api/v1/projects/12/ilal-cases/:id', ({ params }) => HttpResponse.json(envelope(current.find((c) => String(c.id) === params.id)))),
    http.post('*/api/v1/projects/12/ilal-cases', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.created.push(body)
      return HttpResponse.json(envelope(kase({ id: 4, title: body.title, competing_variants: [], critics_judgments: [] })), { status: 201 })
    }),
    http.patch('*/api/v1/projects/12/ilal-cases/:id', async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.patched.push(body)
      const next = { ...current.find((c) => String(c.id) === params.id)!, ...body }
      current = current.map((c) => (String(c.id) === params.id ? next : c))
      return HttpResponse.json(envelope(next))
    }),
  )
  return calls
}

describe('ʿIlal cases', () => {
  it('says the platform grades nothing and lists cases with their status', async () => {
    mockMe()
    mockCases()
    renderApp('/projects/12/analysis/ilal', { signedIn: true })
    expect(await screen.findByText(/The platform grades nothing/)).toBeInTheDocument()
    const list = await screen.findByRole('list', { name: 'Cases' })
    expect(within(list).getByText(/IC-0003/)).toBeInTheDocument()
    expect(within(list).getByText(/Under investigation/)).toBeInTheDocument()
  })

  it('shows an empty state with a way to start a case', async () => {
    mockMe()
    mockCases([])
    renderApp('/projects/12/analysis/ilal', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'No cases yet' })).toBeInTheDocument()
  })

  it('opens a case from the address with its versions, critics and no leaked account details', async () => {
    mockMe()
    mockCases()
    renderApp('/projects/12/analysis/ilal?case=3', { signedIn: true })
    const article = await screen.findByRole('article', { name: /Wakīʿ route/ })
    expect(within(article).getByRole('list', { name: 'Competing versions' })).toHaveTextContent('Version B')
    expect(within(article).getByRole('list', { name: 'What critics said' })).toHaveTextContent('al-ʿIlal 1/42')
    expect(article).not.toHaveTextContent('x@example.org')
    expect(article).toHaveTextContent('not an authenticity grade')
  })

  it('creates a case and opens it', async () => {
    mockMe()
    const calls = mockCases()
    const user = userEvent.setup()
    renderApp('/projects/12/analysis/ilal', { signedIn: true })
    await user.click(await screen.findByRole('button', { name: 'New case' }))
    const dlg = await screen.findByRole('dialog', { name: 'New case' })
    await user.click(within(dlg).getByRole('button', { name: 'Open case' }))
    expect(await within(dlg).findByText('Give the case a title.')).toBeInTheDocument()
    await user.type(within(dlg).getByLabelText(/^Question/), 'Second case')
    await user.click(within(dlg).getByRole('button', { name: 'Open case' }))
    await waitFor(() => expect(calls.created).toEqual([{ title: 'Second case', discrepancy_category: 'ikhtilaf_sanad' }]))
  })

  it('adds a version to the list as it is NOW on the server, keeping a teammate’s', async () => {
    mockMe()
    const calls = mockCases()
    const user = userEvent.setup()
    renderApp('/projects/12/analysis/ilal?case=3', { signedIn: true })
    await user.click(await screen.findByRole('button', { name: 'Add a version' }))
    const dlg = await screen.findByRole('dialog', { name: 'Add a version' })
    await user.type(within(dlg).getByLabelText(/^Name/), 'Version A')
    await user.click(within(dlg).getByRole('button', { name: 'Add version' }))
    expect(await within(dlg).findByText('Another version already has this name.')).toBeInTheDocument()
    await user.clear(within(dlg).getByLabelText(/^Name/))
    await user.type(within(dlg).getByLabelText(/^Name/), 'Version C')
    await user.click(within(dlg).getByRole('button', { name: 'Add version' }))
    await waitFor(() => expect(calls.patched).toHaveLength(1))
    const sent = calls.patched[0]!.competing_variants as { name: string }[]
    expect(sent.map((v) => v.name)).toEqual(['Version A', 'Version B', 'Version C'])
  })

  it('records a critic statement', async () => {
    mockMe()
    const calls = mockCases()
    const user = userEvent.setup()
    renderApp('/projects/12/analysis/ilal?case=3', { signedIn: true })
    await user.click(await screen.findByRole('button', { name: 'Record a critic’s statement' }))
    const dlg = await screen.findByRole('dialog')
    await user.type(within(dlg).getByLabelText(/^Critic/), 'Abū Ḥātim')
    await user.type(within(dlg).getByLabelText(/^What they said/), 'Prefers B')
    await user.click(within(dlg).getByRole('button', { name: 'Record statement' }))
    await waitFor(() => expect(calls.patched).toHaveLength(1))
    expect((calls.patched[0]!.critics_judgments as unknown[]).length).toBe(2)
  })

  it('saves a conclusion: status, preferred version and reasons', async () => {
    mockMe()
    const calls = mockCases()
    const user = userEvent.setup()
    renderApp('/projects/12/analysis/ilal?case=3', { signedIn: true })
    await screen.findByRole('article', { name: /Wakīʿ route/ })
    const save = screen.getByRole('button', { name: 'Save conclusion' })
    expect(save).toBeDisabled()
    await user.selectOptions(screen.getByLabelText(/^Status/), 'resolved_defective')
    await user.selectOptions(screen.getByLabelText(/^Preferred version/), 'Version A')
    await user.type(screen.getByLabelText(/^Reasons/), 'Stronger chain.')
    await user.click(save)
    await waitFor(() => expect(calls.patched).toEqual([{ status: 'resolved_defective', preferred_version: 'Version A', resolution_notes: 'Stronger chain.' }]))
  })

  it('does not let a case with one version be concluded', async () => {
    mockMe()
    mockCases([kase({ competing_variants: [{ name: 'Only' }] })])
    renderApp('/projects/12/analysis/ilal?case=3', { signedIn: true })
    await screen.findByRole('article', { name: /Wakīʿ route/ })
    expect(screen.getByRole('option', { name: 'Concluded: a defect found' })).toBeDisabled()
    expect(screen.getByLabelText(/^Preferred version/)).toBeDisabled()
  })

  it('shows a viewer the conclusion without any form', async () => {
    mockMe()
    mockCases([kase({ status: 'inconclusive', resolution_notes: 'Not enough chains.' })], true)
    renderApp('/projects/12/analysis/ilal?case=3', { signedIn: true })
    await screen.findByRole('article', { name: /Wakīʿ route/ })
    expect(screen.getByText('Not enough chains.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save conclusion' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add a version' })).not.toBeInTheDocument()
  })
})
