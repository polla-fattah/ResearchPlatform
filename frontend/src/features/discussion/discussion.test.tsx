import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { envelope, mockMe, renderApp } from '@/test/helpers'
import { mockProjectApis, projectDetail } from '@/test/projectMocks'
import { server } from '@/test/server'

const pg = (n: number, perPage = 50) => ({ pagination: { current_page: 1, per_page: perPage, total_items: n, total_pages: Math.max(1, Math.ceil(n / perPage)), has_more: n > perPage } })

const thread = (over: Record<string, unknown> = {}) => ({
  id: 14,
  project_id: 12,
  thread_type: 'discussion',
  target_type: 'evidence',
  target_id: 4,
  title: 'Which Sufyān is on the Wakīʿ route?',
  context_quote: null,
  is_resolved: false,
  comments_count: 3,
  updated_at: '2026-10-04T10:00:00Z',
  ...over,
})
const resolvedThread = thread({
  id: 15,
  title: 'Is the second wording a later addition?',
  is_resolved: true,
  target_type: 'finding',
  target_id: 2,
  resolution_notes: 'Read as later, for now.',
  alternative_interpretation: 'Original, per Aras.',
  resolved_at: '2026-10-04T16:20:00Z',
  resolver: { id: 1, display_name: 'Shilan Rashid' },
})
const comment = (id: number, who: string, content: string) => ({ id, thread_id: 14, author_id: id, content, created_at: '2026-10-03T09:00:00Z', author: { id, display_name: who } })

const task = (over: Record<string, unknown> = {}) => ({
  id: 21,
  project_id: 12,
  title: 'Gather the Kufan teacher–student links',
  description: null,
  assignee_id: 2,
  due_date: '2020-01-01T00:00:00.000000Z',
  status: 'in_progress',
  blocking_reason: null,
  assignee: { id: 2, display_name: 'Aras Kamal' },
  ...over,
})

interface Apis {
  threads?: Record<string, unknown>[] | Response
  comments?: Record<string, unknown>[]
  tasks?: Record<string, unknown>[] | Response
  detail?: Record<string, unknown>
  post?: () => Response | undefined
}

function mockDiscussion(o: Apis = {}) {
  const calls = {
    created: [] as Record<string, unknown>[],
    posted: [] as Record<string, unknown>[],
    resolved: [] as Record<string, unknown>[],
    taskQueries: [] as string[],
    taskCreated: [] as Record<string, unknown>[],
    taskPatched: [] as { id: string; body: Record<string, unknown> }[],
    completed: [] as string[],
    blocked: [] as { id: string; body: Record<string, unknown> }[],
  }
  const threads = o.threads ?? [thread(), resolvedThread]
  const tasks = o.tasks ?? [task()]
  mockProjectApis(12, { detail: o.detail ?? projectDetail() })
  server.use(
    http.get('*/api/v1/projects/12/discussions', () => (threads instanceof Response ? threads : HttpResponse.json(envelope(threads, pg(threads.length))))),
    http.post('*/api/v1/projects/12/discussions', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.created.push(body)
      return HttpResponse.json(envelope(thread({ id: 30, title: body.title, target_type: body.target_type, target_id: body.target_id })), { status: 201 })
    }),
    http.get('*/api/v1/discussions/:id/comments', () =>
      HttpResponse.json(envelope(o.comments ?? [comment(1, 'Shilan Rashid', 'Wakīʿ narrates from al-Thawrī in Kufa.'), comment(2, 'Nawroz Ali', 'Could it be Ibn ʿUyayna?')], pg(2))),
    ),
    http.post('*/api/v1/discussions/:id/comments', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.posted.push(body)
      return o.post?.() ?? HttpResponse.json(envelope(comment(9, 'Shilan Rashid', String(body.content))), { status: 201 })
    }),
    http.post('*/api/v1/discussions/:id/resolve', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.resolved.push(body)
      return HttpResponse.json(envelope(thread({ is_resolved: true, resolution_notes: body.resolution_notes })))
    }),
    http.get('*/api/v1/projects/12/tasks', ({ request }) => {
      calls.taskQueries.push(new URL(request.url).search)
      return tasks instanceof Response ? tasks : HttpResponse.json(envelope(tasks, pg(tasks.length, 20)))
    }),
    http.post('*/api/v1/projects/12/tasks', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.taskCreated.push(body)
      return HttpResponse.json(envelope(task({ id: 40, title: body.title, assignee_id: body.assignee_id ?? null, due_date: body.due_date ?? null, status: 'open' })), { status: 201 })
    }),
    http.patch('*/api/v1/projects/12/tasks/:id', async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.taskPatched.push({ id: String(params.id), body })
      return HttpResponse.json(envelope(task({ ...body })))
    }),
    http.post('*/api/v1/projects/12/tasks/:id/complete', ({ params }) => {
      calls.completed.push(String(params.id))
      return HttpResponse.json(envelope(task({ status: 'done' })))
    }),
    http.post('*/api/v1/projects/12/tasks/:id/block', async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.blocked.push({ id: String(params.id), body })
      return HttpResponse.json(envelope(task({ status: 'blocked', blocking_reason: body.blocking_reason })))
    }),
    http.get('*/api/v1/projects/12/members', () =>
      HttpResponse.json(envelope([{ id: 1, user_id: 1, role: 'owner', status: 'accepted', user: { id: 1, display_name: 'Shilan Rashid' } }, { id: 2, user_id: 2, role: 'researcher', status: 'accepted', user: { id: 2, display_name: 'Aras Kamal' } }])),
    ),
  )
  return calls
}

const as = (role: string) => ({ detail: projectDetail({ owner_id: 2, owner: { id: 2, display_name: 'Aras Kamal' }, memberships: [{ user_id: 1, role, status: 'accepted' }] }) })

describe('Discussions', () => {
  it('lists open discussions first with counts, and switches to resolved and all through the address', async () => {
    mockMe()
    mockDiscussion()
    const { router } = renderApp('/projects/12/discussion', { signedIn: true })
    const list = await screen.findByRole('list', { name: 'Discussions' })
    expect(within(list).getByText('Which Sufyān is on the Wakīʿ route?')).toBeInTheDocument()
    expect(within(list).queryByText('Is the second wording a later addition?')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open (1)' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Resolved (1)' }))
    expect(await within(screen.getByRole('list', { name: 'Discussions' })).findByText('Is the second wording a later addition?')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?state=resolved')
    await userEvent.click(screen.getByRole('button', { name: 'All (2)' }))
    expect(within(screen.getByRole('list', { name: 'Discussions' })).getAllByRole('button')).toHaveLength(2)
  })

  it('opens a discussion from the address with its replies, who started it, and a link to what it is about', async () => {
    mockMe()
    mockDiscussion()
    renderApp('/projects/12/discussion?thread=14', { signedIn: true })
    const article = await screen.findByRole('article', { name: 'Which Sufyān is on the Wakīʿ route?' })
    expect(await within(article).findByText('Wakīʿ narrates from al-Thawrī in Kufa.')).toBeInTheDocument()
    expect(within(article).getByText(/started by Shilan Rashid/)).toBeInTheDocument()
    expect(within(article).getByRole('link', { name: 'evidence item 4' })).toHaveAttribute('href', '/projects/12/evidence?item=4')
  })

  it('shows a decision with who made it, the alternative, and that it never changes the corpus', async () => {
    mockMe()
    mockDiscussion()
    renderApp('/projects/12/discussion?thread=15&state=resolved', { signedIn: true })
    const decision = await screen.findByRole('region', { name: 'Resolved' })
    expect(within(decision).getByText('Read as later, for now.')).toBeInTheDocument()
    expect(within(decision).getByText(/decided by Shilan Rashid/)).toBeInTheDocument()
    expect(within(decision).getByText(/Original, per Aras\./)).toBeInTheDocument()
    expect(within(decision).getByText(/never changes the corpus/)).toBeInTheDocument()
    expect(screen.getByLabelText('Add a reply under the decision')).toBeInTheDocument()
  })

  it('posts a reply, clears the box, and keeps the text when posting fails', async () => {
    mockMe()
    let fail = true
    const calls = mockDiscussion({
      post: () =>
        fail ? HttpResponse.json({ success: false, error: { code: 'ERROR', message: 'x' } }, { status: 500 }) : undefined,
    })
    renderApp('/projects/12/discussion?thread=14', { signedIn: true })
    const box = await screen.findByLabelText('Reply')
    await userEvent.type(box, 'Agreed, with a caveat.')
    await userEvent.click(screen.getByRole('button', { name: 'Post reply' }))
    expect(await screen.findByText(/The reply was not posted/)).toBeInTheDocument()
    expect(screen.getByText('Your text is still in the box.')).toBeInTheDocument()
    expect(box).toHaveValue('Agreed, with a caveat.')
    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Post reply' }))
    await waitFor(() => expect(box).toHaveValue(''))
    expect(calls.posted).toEqual([{ content: 'Agreed, with a caveat.' }, { content: 'Agreed, with a caveat.' }])
  })

  it('resolves with a decision and its reason, and refuses an empty decision', async () => {
    mockMe()
    const calls = mockDiscussion()
    renderApp('/projects/12/discussion?thread=14', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Resolve…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Resolve D-0014' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Resolve discussion' }))
    expect(await within(dialog).findByText(/write the decision and its reason/i)).toBeInTheDocument()
    expect(calls.resolved).toEqual([])
    await userEvent.type(within(dialog).getByLabelText(/Decision and reason/), 'Read as al-Thawrī.')
    await userEvent.type(within(dialog).getByLabelText(/Alternative interpretations/), 'Ibn ʿUyayna, per Nawroz.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Resolve discussion' }))
    await waitFor(() => expect(calls.resolved).toEqual([{ resolution_notes: 'Read as al-Thawrī.', alternative_interpretation: 'Ibn ʿUyayna, per Nawroz.' }]))
  })

  it('starts a discussion about the project, then opens it', async () => {
    mockMe()
    const calls = mockDiscussion()
    const { router } = renderApp('/projects/12/discussion', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'New discussion' }))
    const dialog = await screen.findByRole('dialog', { name: 'New discussion' })
    expect(within(dialog).getByText('About this project.')).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText(/^Title/), 'Scope of the Kufan routes')
    await userEvent.type(within(dialog).getByLabelText(/First comment/), 'Should we include Basran routes?')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Open discussion' }))
    await waitFor(() => expect(calls.created).toEqual([{ title: 'Scope of the Kufan routes', target_type: 'project', target_id: 12, initial_comment: 'Should we include Basran routes?' }]))
    await waitFor(() => expect(router.state.location.search).toBe('?thread=30'))
  })

  it('opens the dialog for an item when the address says so (the link an item’s own screen uses)', async () => {
    mockMe()
    const calls = mockDiscussion()
    renderApp('/projects/12/discussion?new=1&targetType=evidence&targetId=4', { signedIn: true })
    const dialog = await screen.findByRole('dialog', { name: 'New discussion' })
    expect(within(dialog).getByText('About evidence item 4.')).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText(/^Title/), 'Check the locator')
    await userEvent.type(within(dialog).getByLabelText(/First comment/), 'Page 14 or 41?')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Open discussion' }))
    await waitFor(() => expect(calls.created[0]).toMatchObject({ target_type: 'evidence', target_id: 4 }))
  })

  it('says so when there are none, and offers the first one', async () => {
    mockMe()
    mockDiscussion({ threads: [] })
    renderApp('/projects/12/discussion', { signedIn: true })
    expect(await screen.findByText('No discussions yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start the first discussion' })).toBeInTheDocument()
  })

  it('a viewer can read but not start, reply or resolve', async () => {
    mockMe()
    mockDiscussion(as('viewer'))
    renderApp('/projects/12/discussion?thread=14', { signedIn: true })
    await screen.findByRole('article', { name: 'Which Sufyān is on the Wakīʿ route?' })
    expect(screen.getByText(/You are a Viewer in this project/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New discussion' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Reply')).not.toBeInTheDocument()
    expect(screen.getByText('You can read this discussion but not reply to it.')).toBeInTheDocument()
  })

  it('a project reviewer can reply but not resolve', async () => {
    mockMe()
    mockDiscussion(as('reviewer'))
    renderApp('/projects/12/discussion?thread=14', { signedIn: true })
    expect(await screen.findByLabelText('Reply')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Resolve…' })).not.toBeInTheDocument()
  })

  it('keeps the list and says so when it cannot be refreshed', async () => {
    mockMe()
    mockDiscussion()
    renderApp('/projects/12/discussion?thread=14', { signedIn: true })
    await screen.findByRole('article', { name: 'Which Sufyān is on the Wakīʿ route?' })
    server.use(http.get('*/api/v1/projects/12/discussions', () => HttpResponse.json({ success: false, error: { code: 'ERROR', message: 'x' } }, { status: 500 })))
    await userEvent.type(screen.getByLabelText('Reply'), 'One more thing.')
    await userEvent.click(screen.getByRole('button', { name: 'Post reply' }))
    await waitFor(() => expect((screen.getByLabelText('Reply') as HTMLTextAreaElement).value).toBe(''))
    expect(await screen.findByText(/Discussions could not be refreshed/)).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Discussions' })).toBeInTheDocument()
  })

  it('reports a reply the server accepted but did not keep', async () => {
    mockMe()
    mockDiscussion({ post: () => HttpResponse.json(envelope(comment(9, 'Shilan Rashid', 'something else')), { status: 201 }) })
    renderApp('/projects/12/discussion?thread=14', { signedIn: true })
    await userEvent.type(await screen.findByLabelText('Reply'), 'My words')
    await userEvent.click(screen.getByRole('button', { name: 'Post reply' }))
    expect(await screen.findByText(/did not keep/)).toBeInTheDocument()
  })
})

describe('Tasks', () => {
  it('lists tasks with state, assignee and due day, marks an old unfinished one overdue, and shows why a blocked one is blocked', async () => {
    mockMe()
    mockDiscussion({ tasks: [task(), task({ id: 22, title: 'Check the Basran chain', status: 'blocked', blocking_reason: 'Waiting for the scan', due_date: null, assignee: null, assignee_id: null })] })
    renderApp('/projects/12/discussion?view=tasks', { signedIn: true })
    const table = await screen.findByRole('table', { name: 'Tasks' })
    const first = within(table).getByRole('row', { name: /Gather the Kufan/ })
    expect(within(first).getByText('In progress')).toBeInTheDocument()
    expect(within(first).getByText('Aras Kamal')).toBeInTheDocument()
    expect(within(first).getByText('Overdue')).toBeInTheDocument()
    const second = within(table).getByRole('row', { name: /Check the Basran chain/ })
    expect(within(second).getByText(/Blocked because/)).toBeInTheDocument()
    expect(within(second).getByText('Waiting for the scan')).toBeInTheDocument()
    expect(within(second).getByText('Nobody')).toBeInTheDocument()
  })

  it('filters by state and by "assigned to me" on the server, through the address', async () => {
    mockMe()
    const calls = mockDiscussion()
    renderApp('/projects/12/discussion?view=tasks', { signedIn: true })
    await screen.findByRole('table', { name: 'Tasks' })
    await userEvent.click(screen.getByRole('button', { name: 'Blocked' }))
    await userEvent.click(screen.getByRole('button', { name: 'Assigned to me' }))
    await waitFor(() => expect(calls.taskQueries.at(-1)).toContain('status=blocked'))
    expect(calls.taskQueries.at(-1)).toContain('assignee_id=1')
  })

  it('creates a task with an assignee chosen from the members and a due day', async () => {
    mockMe()
    const calls = mockDiscussion()
    renderApp('/projects/12/discussion?view=tasks', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'New task' }))
    const dialog = await screen.findByRole('dialog', { name: 'New task' })
    await userEvent.type(within(dialog).getByLabelText(/^Task/), 'Collect Abū Isḥāq’s students')
    await userEvent.selectOptions(await within(dialog).findByLabelText(/Assigned to/), 'Aras Kamal · Researcher')
    await userEvent.type(within(dialog).getByLabelText(/Due/), '2026-10-30')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save task' }))
    await waitFor(() => expect(calls.taskCreated).toEqual([{ title: 'Collect Abū Isḥāq’s students', description: null, assignee_id: 2, due_date: '2026-10-30' }]))
  })

  it('edits a task and keeps Done and Blocked for their own actions', async () => {
    mockMe()
    const calls = mockDiscussion()
    renderApp('/projects/12/discussion?view=tasks', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Gather the Kufan teacher–student links' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByRole('option', { name: 'Done' })).not.toBeInTheDocument()
    await userEvent.selectOptions(within(dialog).getByLabelText('State'), 'Open')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save task' }))
    await waitFor(() => expect(calls.taskPatched[0]).toMatchObject({ id: '21', body: { status: 'open', title: 'Gather the Kufan teacher–student links', assignee_id: 2 } }))
  })

  it('marks a task done through its own action', async () => {
    mockMe()
    const calls = mockDiscussion()
    renderApp('/projects/12/discussion?view=tasks', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Mark Gather the Kufan teacher–student links done' }))
    await waitFor(() => expect(calls.completed).toEqual(['21']))
  })

  it('needs a reason to mark a task blocked', async () => {
    mockMe()
    const calls = mockDiscussion()
    renderApp('/projects/12/discussion?view=tasks', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Mark Gather the Kufan teacher–student links blocked' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark blocked' }))
    expect(await within(dialog).findByText(/say what is blocking it/i)).toBeInTheDocument()
    expect(calls.blocked).toEqual([])
    await userEvent.type(within(dialog).getByLabelText(/What is blocking it/), 'Waiting for the scan')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark blocked' }))
    await waitFor(() => expect(calls.blocked).toEqual([{ id: '21', body: { blocking_reason: 'Waiting for the scan' } }]))
  })

  it('says so when there are no tasks, and when filters match none', async () => {
    mockMe()
    mockDiscussion({ tasks: [] })
    renderApp('/projects/12/discussion?view=tasks', { signedIn: true })
    expect(await screen.findByText('No tasks yet')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(await screen.findByText('No tasks match these filters.')).toBeInTheDocument()
  })

  it('a project reviewer sees tasks but has no way to create, edit, finish or block them', async () => {
    mockMe()
    mockDiscussion(as('reviewer'))
    renderApp('/projects/12/discussion?view=tasks', { signedIn: true })
    await screen.findByRole('table', { name: 'Tasks' })
    expect(screen.queryByRole('button', { name: 'New task' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /done$/ })).not.toBeInTheDocument()
  })
})
