import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { envelope, mockMe, renderApp } from '@/test/helpers'
import { mockProjectApis, projectDetail } from '@/test/projectMocks'
import { server } from '@/test/server'

const pg = (n: number, page = 1, perPage = 30) => ({ pagination: { current_page: page, per_page: perPage, total_items: n, total_pages: Math.max(1, Math.ceil(n / perPage)), has_more: page * perPage < n } })

const entry = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  project_id: 12,
  actor_id: 1,
  action: 'task_created',
  object_type: 'task',
  object_id: 5,
  summary: "Created task: 'Collect the links'",
  created_at: '2026-10-04T09:30:00',
  actor: { id: 1, display_name: 'Shilan Rashid' },
  ...over,
})

interface Apis {
  items?: Record<string, unknown>[]
  total?: number
  detail?: Record<string, unknown>
  list?: () => Response | undefined
}

function mockActivity(o: Apis = {}) {
  const items = o.items ?? [
    entry(1),
    entry(2, { action: 'invitation_created', object_type: 'invitation', object_id: 7, summary: 'Invited dilan@example.org as Viewer', created_at: '2026-10-04T08:00:00' }),
    entry(3, { action: 'discussion_opened', object_type: 'discussion_thread', object_id: 14, summary: "Opened discussion: 'Which Sufyān?'", created_at: '2026-10-03T10:00:00', actor: { id: 2, display_name: 'Aras Kamal' } }),
    entry(4, { action: 'evidence_state_changed', object_type: 'evidence', object_id: 27, summary: 'Evidence EV-0027 moved to included', created_at: '2026-10-03T09:00:00' }),
  ]
  const calls = { queries: [] as URLSearchParams[] }
  mockProjectApis(12, { detail: o.detail ?? projectDetail() })
  server.use(
    http.get('*/api/v1/projects/12/activity', ({ request }) => {
      calls.queries.push(new URL(request.url).searchParams)
      return o.list?.() ?? HttpResponse.json(envelope(items, pg(o.total ?? items.length)))
    }),
    http.get('*/api/v1/projects/12/members', () =>
      HttpResponse.json(envelope([{ id: 1, user_id: 1, role: 'owner', status: 'accepted', user: { id: 1, display_name: 'Shilan Rashid' } }, { id: 2, user_id: 2, role: 'researcher', status: 'accepted', user: { id: 2, display_name: 'Aras Kamal' } }])),
    ),
  )
  return calls
}

const asViewer = { detail: projectDetail({ owner_id: 2, owner: { id: 2, display_name: 'Aras Kamal' }, memberships: [{ user_id: 1, role: 'viewer', status: 'accepted' }] }) }

describe('Activity', () => {
  it('lists entries by day with who, what and the kind of change, newest first', async () => {
    mockMe()
    mockActivity()
    renderApp('/projects/12/activity', { signedIn: true })
    expect(await screen.findByText("Created task: 'Collect the links'")).toBeInTheDocument()
    expect(screen.getAllByRole('region').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText("Opened discussion: 'Which Sufyān?'")).toBeInTheDocument()
    expect(screen.getByText('4 entries')).toBeInTheDocument()
    const row = screen.getByText("Opened discussion: 'Which Sufyān?'").closest('li')!
    expect(within(row).getByText('Aras Kamal')).toBeInTheDocument()
    expect(within(row).getByText('Discussion opened')).toBeInTheDocument()
  })

  it('leads each entry to the screen that shows what it is about', async () => {
    mockMe()
    mockActivity()
    renderApp('/projects/12/activity', { signedIn: true })
    await screen.findByText("Created task: 'Collect the links'")
    const link = (text: string) => within(screen.getByText(text).closest('li')!).getByRole('link', { name: 'Open' })
    expect(link("Created task: 'Collect the links'")).toHaveAttribute('href', '/projects/12/discussion?view=tasks')
    expect(link("Opened discussion: 'Which Sufyān?'")).toHaveAttribute('href', '/projects/12/discussion?thread=14&state=all')
    expect(link('Evidence EV-0027 moved to included')).toHaveAttribute('href', '/projects/12/evidence?item=27')
  })

  it('shows the owner who was invited, and anyone else only that an invitation was sent', async () => {
    mockMe()
    mockActivity()
    const { unmount } = renderApp('/projects/12/activity', { signedIn: true })
    expect(await screen.findByText('Invited dilan@example.org as Viewer')).toBeInTheDocument()
    unmount()
    mockMe()
    mockActivity(asViewer)
    renderApp('/projects/12/activity', { signedIn: true })
    expect(await screen.findByText(/An invitation was sent\. Who it was sent to is shown to the owner only\./)).toBeInTheDocument()
    expect(screen.queryByText(/dilan@example.org/)).not.toBeInTheDocument()
  })

  it('sends every filter to the server and keeps them in the address', async () => {
    mockMe()
    const calls = mockActivity()
    const { router } = renderApp('/projects/12/activity', { signedIn: true })
    await screen.findByText("Created task: 'Collect the links'")
    await userEvent.selectOptions(screen.getByLabelText('Who'), 'Aras Kamal')
    await userEvent.selectOptions(screen.getByLabelText('Object'), 'Evidence')
    await userEvent.selectOptions(screen.getByLabelText('Action'), 'Evidence state changed')
    await userEvent.selectOptions(screen.getByLabelText('When'), 'Last 7 days')
    await waitFor(() => {
      const q = calls.queries.at(-1)!
      expect(q.get('actor_id')).toBe('2')
      expect(q.get('object_type')).toBe('evidence')
      expect(q.get('action')).toBe('evidence_state_changed')
      expect(q.get('from')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
    expect(router.state.location.search).toBe('?actor=2&object=evidence&action=evidence_state_changed&range=7')
  })

  it('starts from the filters in the address, and clears them all', async () => {
    mockMe()
    const calls = mockActivity()
    const { router } = renderApp('/projects/12/activity?object=task&range=30', { signedIn: true })
    await screen.findByText("Created task: 'Collect the links'")
    expect(screen.getByLabelText('Object')).toHaveValue('task')
    expect(screen.getByLabelText('When')).toHaveValue('30')
    expect(calls.queries[0]!.get('object_type')).toBe('task')
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(router.state.location.search).toBe('')
  })

  it('says there is no activity yet, and when filters match nothing', async () => {
    mockMe()
    mockActivity({ items: [] })
    renderApp('/projects/12/activity', { signedIn: true })
    expect(await screen.findByText('No activity yet')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Object'), 'Tasks')
    expect(await screen.findByText('No activity matches these filters')).toBeInTheDocument()
  })

  it('pages through the entries, with the page in the address', async () => {
    mockMe()
    const calls = mockActivity({ total: 75 })
    const { router } = renderApp('/projects/12/activity', { signedIn: true })
    await screen.findByText("Created task: 'Collect the links'")
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(calls.queries.at(-1)!.get('page')).toBe('2'))
    expect(router.state.location.search).toBe('?page=2')
  })

  it('shows an error with a retry when the first load fails', async () => {
    mockMe()
    mockActivity({ list: () => HttpResponse.json({ success: false, error: { code: 'ERROR', message: 'x' } }, { status: 500 }) })
    renderApp('/projects/12/activity', { signedIn: true })
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('shows an entry of a kind it does not know by its own name', async () => {
    mockMe()
    mockActivity({ items: [entry(9, { action: 'finding_created', object_type: 'finding', summary: 'Created a finding' })] })
    renderApp('/projects/12/activity', { signedIn: true })
    expect(await screen.findByText('finding_created')).toBeInTheDocument()
    expect(screen.getByText('Created a finding')).toBeInTheDocument()
  })

  it('looks the same for a project that cannot be opened', async () => {
    mockMe()
    mockProjectApis(12, { detail: new Response(JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found.' } }), { status: 404 }) })
    renderApp('/projects/12/activity', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'Project not available' })).toBeInTheDocument()
  })
})
