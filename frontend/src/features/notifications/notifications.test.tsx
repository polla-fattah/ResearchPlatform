import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { envelope, mockHomeApis, mockMe, renderApp } from '@/test/helpers'
import { server } from '@/test/server'

const pg = (n: number, page = 1) => ({ pagination: { current_page: page, per_page: 20, total_items: n, total_pages: Math.max(1, Math.ceil(n / 20)), has_more: page * 20 < n } })

const note = (over: Record<string, unknown> = {}) => ({
  id: 1,
  type: 'invitation_accepted',
  title: 'Researcher Joined Project',
  message: "Aras Kamal accepted the invitation to join 'Chains of the wuḍūʾ reports'.",
  target_type: 'project',
  target_id: 12,
  is_read: false,
  read_at: null,
  created_at: new Date(Date.now() - 3600_000).toISOString(),
  ...over,
})

interface Apis {
  items?: Record<string, unknown>[]
  unread?: number
  list?: () => Response | undefined
  tasks?: Record<string, unknown>[]
}

function mockNotifications(o: Apis = {}) {
  const items = o.items ?? [note(), note({ id: 2, type: 'role_updated', message: "Your role in 'Chains' was changed to viewer.", is_read: true }), note({ id: 3, type: 'assignment', target_type: 'task', target_id: 21, message: "You were assigned to 'Collect the links'." }), note({ id: 4, type: 'invitation', message: "You have been invited to join 'Sorani guide' as researcher.", target_id: 99 })]
  const calls = { queries: [] as string[], read: [] as string[], readAll: 0 }
  mockHomeApis({ unread: o.unread ?? 3 })
  server.use(
    http.get('*/api/v1/notifications', ({ request }) => {
      calls.queries.push(new URL(request.url).search)
      return o.list?.() ?? HttpResponse.json(envelope({ unread_count: o.unread ?? items.filter((i) => !i.is_read).length, notifications: items }, pg(items.length)))
    }),
    http.patch('*/api/v1/notifications/:id/read', ({ params }) => {
      calls.read.push(String(params.id))
      const found = items.find((i) => i.id === Number(params.id))
      if (found) found.is_read = true
      return HttpResponse.json(envelope(found))
    }),
    http.post('*/api/v1/notifications/mark-all-read', () => {
      calls.readAll++
      items.forEach((i) => (i.is_read = true))
      return HttpResponse.json(envelope(null))
    }),
    http.get('*/api/v1/me/tasks', () => HttpResponse.json(envelope(o.tasks ?? [{ id: 21, project_id: 12, project: { id: 12, title: 'Chains' } }], pg(1)))),
  )
  return calls
}

describe('Notifications', () => {
  it('lists them with their kind, says which are new in words, and counts the unread', async () => {
    mockMe()
    mockNotifications()
    renderApp('/notifications', { signedIn: true })
    const list = await screen.findByRole('list', { name: 'Notifications' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(4)
    expect(within(list).getByText(/Aras Kamal accepted the invitation/)).toBeInTheDocument()
    expect(within(list).getAllByText('New')).toHaveLength(3)
    expect(screen.getByText(/3 unread/)).toBeInTheDocument()
    expect(screen.getByText(/4 notifications/)).toBeInTheDocument()
  })

  it('leads each kind where it can honestly lead, and an invitation nowhere', async () => {
    mockMe()
    mockNotifications()
    renderApp('/notifications', { signedIn: true })
    const list = await screen.findByRole('list', { name: 'Notifications' })
    const rows = within(list).getAllByRole('listitem')
    expect(within(rows[0]!).getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/projects/12/members')
    expect(within(rows[1]!).getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/projects/12/overview')
    await waitFor(() => expect(within(rows[2]!).getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/projects/12/discussion?view=tasks&mine=1'))
    expect(within(rows[3]!).queryByRole('link')).not.toBeInTheDocument()
    expect(within(rows[3]!).getByText(/Open the invitation link the owner sent you/)).toBeInTheDocument()
  })

  it('gives a task notification no link when its project cannot be found', async () => {
    mockMe()
    mockNotifications({ tasks: [] })
    renderApp('/notifications', { signedIn: true })
    const list = await screen.findByRole('list', { name: 'Notifications' })
    const row = within(list).getAllByRole('listitem')[2]!
    await waitFor(() => expect(within(row).queryByRole('link')).not.toBeInTheDocument())
  })

  it('marks one as read from the server, then shows it read', async () => {
    mockMe()
    const calls = mockNotifications()
    renderApp('/notifications', { signedIn: true })
    const list = await screen.findByRole('list', { name: 'Notifications' })
    await userEvent.click(within(within(list).getAllByRole('listitem')[0]!).getByRole('button', { name: 'Mark as read' }))
    await waitFor(() => expect(calls.read).toEqual(['1']))
    await waitFor(() => expect(within(list).getAllByText('New')).toHaveLength(2))
  })

  it('marks one as read when it is opened', async () => {
    mockMe()
    const calls = mockNotifications()
    mockProject()
    renderApp('/notifications', { signedIn: true })
    const list = await screen.findByRole('list', { name: 'Notifications' })
    await userEvent.click(within(within(list).getAllByRole('listitem')[0]!).getByRole('link', { name: 'Open' }))
    await waitFor(() => expect(calls.read).toEqual(['1']))
  })

  it('marks all as read, and the button is off when nothing is unread', async () => {
    mockMe()
    const calls = mockNotifications()
    renderApp('/notifications', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Mark all as read' }))
    await waitFor(() => expect(calls.readAll).toBe(1))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeDisabled())
  })

  it('filters by kind on the server through the address, and by unread on the page', async () => {
    mockMe()
    const calls = mockNotifications()
    const { router } = renderApp('/notifications', { signedIn: true })
    await screen.findByRole('list', { name: 'Notifications' })
    await userEvent.click(screen.getByRole('button', { name: 'Task assigned' }))
    await waitFor(() => expect(calls.queries.at(-1)).toContain('type=assignment'))
    expect(router.state.location.search).toBe('?type=assignment')
    await userEvent.click(screen.getByRole('button', { name: 'All' }))
    await userEvent.click(screen.getByRole('button', { name: 'Unread only' }))
    const list = await screen.findByRole('list', { name: 'Notifications' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    expect(router.state.location.search).toBe('?unread=1')
  })

  it('says everything is read when there is nothing, and when a filter matches nothing', async () => {
    mockMe()
    mockNotifications({ items: [], unread: 0 })
    renderApp('/notifications', { signedIn: true })
    expect(await screen.findByText("You're all caught up")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Joined' }))
    expect(await screen.findByText('No notifications match this view.')).toBeInTheDocument()
  })

  it('shows a kind it does not know by its own name', async () => {
    mockMe()
    mockNotifications({ items: [note({ id: 9, type: 'review_due', message: 'A review is due.', target_type: null, target_id: null })] })
    renderApp('/notifications', { signedIn: true })
    expect(await screen.findByText('review_due')).toBeInTheDocument()
    expect(screen.getByText('A review is due.')).toBeInTheDocument()
  })

  it('keeps what was loaded and says so when a refresh fails, and offers to try again', async () => {
    mockMe()
    const calls = mockNotifications()
    renderApp('/notifications', { signedIn: true })
    await screen.findByRole('list', { name: 'Notifications' })
    server.use(http.get('*/api/v1/notifications', () => HttpResponse.json({ success: false, error: { code: 'ERROR', message: 'x' } }, { status: 500 })))
    await userEvent.click(screen.getByRole('button', { name: 'Mark all as read' }))
    expect(await screen.findByText(/Notifications could not be refreshed/)).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Notifications' })).toBeInTheDocument()
    expect(calls.readAll).toBe(1)
  })

  it('shows the error with a retry when the first load fails', async () => {
    mockMe()
    mockNotifications({ list: () => HttpResponse.json({ success: false, error: { code: 'ERROR', message: 'x' } }, { status: 500 }) })
    renderApp('/notifications', { signedIn: true })
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('links to the preferences on the settings screen', async () => {
    mockMe()
    mockNotifications()
    renderApp('/notifications', { signedIn: true })
    expect(await screen.findByRole('link', { name: 'Preferences' })).toHaveAttribute('href', '/settings?tab=notifications')
  })
})

function mockProject() {
  server.use(
    http.get('*/api/v1/projects/12', () => HttpResponse.json(envelope({ id: 12, owner_id: 1, title: 'Chains', stage: 'analysing', is_archived: false, is_deleted: false, memberships: [] }))),
    http.get('*/api/v1/projects/12/members', () => HttpResponse.json(envelope([]))),
    http.get('*/api/v1/projects/12/invitations', () => HttpResponse.json(envelope([], pg(0)))),
  )
}
