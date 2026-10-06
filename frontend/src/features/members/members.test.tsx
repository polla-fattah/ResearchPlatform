import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { envelope, mockMe, renderApp } from '@/test/helpers'
import { mockProjectApis, projectDetail } from '@/test/projectMocks'
import { server } from '@/test/server'

const pg = (n: number) => ({ pagination: { current_page: 1, per_page: 50, total_items: n, total_pages: 1, has_more: false } })

const member = (over: Record<string, unknown> = {}) => ({
  id: 2,
  user_id: 2,
  role: 'researcher',
  status: 'accepted',
  joined_at: '2026-09-20T09:00:00Z',
  invited_by: 1,
  user: { id: 2, display_name: 'Aras Kamal', affiliation: 'Soran University' },
  contribution_summary: { evidence_items: 14, findings: 99, documents: 3, comments: 9, tasks: 2 },
  ...over,
})
const ownerRow = member({ id: 1, user_id: 1, role: 'owner', user: { id: 1, display_name: 'Shilan Rashid', affiliation: null }, contribution_summary: { evidence_items: 20, documents: 5, comments: 4, tasks: 0 } })

const invitation = (over: Record<string, unknown> = {}) => ({
  id: 7,
  email: 'dilan@example.org',
  role: 'viewer',
  token: 'tok-abc',
  status: 'pending',
  expires_at: '2099-01-01T00:00:00Z',
  created_at: '2026-10-01T00:00:00Z',
  inviter: { id: 1, display_name: 'Shilan Rashid' },
  ...over,
})

interface Apis {
  members?: Record<string, unknown>[] | Response
  invitations?: Record<string, unknown>[] | Response
  detail?: Record<string, unknown>
}

function mockMembers(o: Apis = {}) {
  const calls = {
    invitationLists: 0,
    created: [] as Record<string, unknown>[],
    patched: [] as { id: string; body: Record<string, unknown> }[],
    removed: [] as string[],
    resent: [] as string[],
    withdrawn: [] as string[],
    left: 0,
  }
  const members = o.members ?? [ownerRow, member(), member({ id: 3, user_id: 3, status: 'revoked', user: { id: 3, display_name: 'Revoked Person' } })]
  const invitations = o.invitations ?? [invitation()]
  mockProjectApis(12, { detail: o.detail ?? projectDetail() })
  server.use(
    http.get('*/api/v1/projects/12/members', () => (members instanceof Response ? members : HttpResponse.json(envelope(members)))),
    http.get('*/api/v1/projects/12/invitations', () => {
      calls.invitationLists++
      return invitations instanceof Response ? invitations : HttpResponse.json(envelope(invitations, pg(invitations.length)))
    }),
    http.post('*/api/v1/projects/12/invitations', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.created.push(body)
      return HttpResponse.json(envelope(invitation({ id: 8, email: body.email, role: body.role, token: 'fresh-token' })), { status: 201 })
    }),
    http.post('*/api/v1/projects/12/invitations/:id/resend', ({ params }) => {
      calls.resent.push(String(params.id))
      return HttpResponse.json(envelope(invitation()))
    }),
    http.delete('*/api/v1/projects/12/invitations/:id', ({ params }) => {
      calls.withdrawn.push(String(params.id))
      return HttpResponse.json(envelope(null))
    }),
    http.patch('*/api/v1/projects/12/members/:userId', async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.patched.push({ id: String(params.userId), body })
      return HttpResponse.json(envelope({ id: 2, user_id: 2, role: body.role, status: 'accepted' }))
    }),
    http.delete('*/api/v1/projects/12/members/:userId', ({ params }) => {
      calls.removed.push(String(params.userId))
      return HttpResponse.json(envelope(null))
    }),
    http.post('*/api/v1/projects/12/leave', () => {
      calls.left++
      return HttpResponse.json(envelope(null))
    }),
  )
  return calls
}

const asResearcher = { detail: projectDetail({ owner_id: 2, owner: { id: 2, display_name: 'Aras Kamal' }, memberships: [{ user_id: 1, role: 'researcher', status: 'accepted' }] }) }
const asViewer = { detail: projectDetail({ owner_id: 2, owner: { id: 2, display_name: 'Aras Kamal' }, memberships: [{ user_id: 1, role: 'viewer', status: 'accepted' }] }) }

describe('Members (owner)', () => {
  it('lists the people in the project with role, join date and what each added, and leaves out a revoked member', async () => {
    mockMe()
    mockMembers()
    renderApp('/projects/12/members', { signedIn: true })
    const table = await screen.findByRole('table', { name: 'Project members' })
    expect(within(table).getByText('Shilan Rashid')).toBeInTheDocument()
    expect(within(table).getByText('You')).toBeInTheDocument()
    expect(within(table).getByText('Aras Kamal')).toBeInTheDocument()
    expect(within(table).getByText('Soran University')).toBeInTheDocument()
    expect(within(table).queryByText('Revoked Person')).not.toBeInTheDocument()
    expect(screen.getByText('2 people in this project')).toBeInTheDocument()
    // The member's own numbers, never the project-wide findings count the server also sends.
    expect(within(table).getByText(/14 evidence · 3 document versions · 9 comments · 2 tasks/)).toBeInTheDocument()
    expect(within(table).queryByText(/99/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Invite member' })).toBeInTheDocument()
  })

  it('shows the permission table from the same rules the screens use', async () => {
    mockMe()
    mockMembers()
    renderApp('/projects/12/members', { signedIn: true })
    const matrix = await screen.findByRole('table', { name: 'What each role can do' })
    const row = within(matrix).getByRole('row', { name: /Manage members/ })
    expect(within(row).getAllByText('Allowed')).toHaveLength(1)
    expect(within(row).getAllByText('Not allowed')).toHaveLength(3)
  })

  it('says so when the owner is alone and offers the first invitation', async () => {
    mockMe()
    mockMembers({ members: [ownerRow], invitations: [] })
    renderApp('/projects/12/members', { signedIn: true })
    expect(await screen.findByText('Only you so far')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Invite the first member' })).toBeInTheDocument()
    expect(await screen.findByText('No invitations are waiting.')).toBeInTheDocument()
  })

  it('adds the project’s owner to the list when the server leaves them out', async () => {
    mockMe()
    mockMembers({ members: [member()] })
    renderApp('/projects/12/members', { signedIn: true })
    const table = await screen.findByRole('table', { name: 'Project members' })
    expect(within(table).getByText('Shilan Rashid')).toBeInTheDocument()
    expect(within(table).getByText('Not reported')).toBeInTheDocument()
  })

  it('keeps the people on screen and says so when a refresh fails', async () => {
    mockMe()
    const calls = mockMembers()
    renderApp('/projects/12/members', { signedIn: true })
    await screen.findByText('Aras Kamal')
    server.use(http.get('*/api/v1/projects/12/members', () => HttpResponse.json({ success: false, error: { code: 'ERROR', message: 'x' } }, { status: 500 })))
    // Removing someone refetches the same query; that refresh fails.
    await userEvent.click(screen.getByRole('button', { name: 'Remove Aras Kamal' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove Aras Kamal' }))
    await waitFor(() => expect(calls.removed).toEqual(['2']))
    expect(await screen.findByText(/could not be refreshed/)).toBeInTheDocument()
    expect(screen.getByText('Aras Kamal')).toBeInTheDocument()
  })
})

describe('Members: inviting', () => {
  it('sends the e-mail and role with the 14-day expiry, then hands over the link because no e-mail is sent', async () => {
    mockMe()
    const calls = mockMembers()
    renderApp('/projects/12/members', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Invite member' }))
    const dialog = await screen.findByRole('dialog', { name: 'Invite to PRJ-0012' })
    await userEvent.type(within(dialog).getByLabelText(/E-mail address/), 'new@example.org')
    await userEvent.click(within(dialog).getByRole('radio', { name: /Project reviewer/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send invitation' }))
    const sent = await screen.findByRole('dialog', { name: 'Invitation created' })
    expect(calls.created).toEqual([{ email: 'new@example.org', role: 'reviewer', expires_days: 14 }])
    expect(within(sent).getByText(/No e-mail is sent by the platform yet/)).toBeInTheDocument()
    expect(within(sent).getByLabelText('Invitation link')).toHaveValue(`${window.location.origin}/invitations/fresh-token`)
  })

  it('does not send an address that is not an address', async () => {
    mockMe()
    const calls = mockMembers()
    renderApp('/projects/12/members', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Invite member' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText(/E-mail address/), 'nobody')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send invitation' }))
    expect(await within(dialog).findByText('Enter a full address such as name@example.org')).toBeInTheDocument()
    expect(calls.created).toEqual([])
  })

  it('shows the server’s reason when the person is already invited, and keeps what was typed', async () => {
    mockMe()
    mockMembers()
    server.use(
      http.post('*/api/v1/projects/12/invitations', () =>
        HttpResponse.json({ success: false, error: { code: 'CONFLICT', message: 'This researcher already has a pending invitation for this project.' } }, { status: 409 }),
      ),
    )
    renderApp('/projects/12/members', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Invite member' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText(/E-mail address/), 'dilan@example.org')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send invitation' }))
    expect(await within(dialog).findByText(/already has a pending invitation/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/E-mail address/)).toHaveValue('dilan@example.org')
  })

  it('lists open invitations with their state, a link while waiting, and resends or withdraws them', async () => {
    mockMe()
    const calls = mockMembers({
      invitations: [invitation(), invitation({ id: 9, email: 'old@example.org', token: 'old', expires_at: '2020-01-01T00:00:00Z' }), invitation({ id: 10, email: 'done@example.org', status: 'accepted' })],
    })
    renderApp('/projects/12/members', { signedIn: true })
    const table = await screen.findByRole('table', { name: 'Invitations' })
    expect(within(table).getByText('Waiting for an answer')).toBeInTheDocument()
    expect(within(table).getByText('Expired: no access was given')).toBeInTheDocument()
    expect(within(table).queryByText('done@example.org')).not.toBeInTheDocument()
    expect(within(table).getAllByLabelText('Invitation link')).toHaveLength(1)

    const waiting = within(table).getByRole('row', { name: /dilan@example.org/ })
    await userEvent.click(within(waiting).getByRole('button', { name: 'Send again' }))
    await waitFor(() => expect(calls.resent).toEqual(['7']))

    await userEvent.click(within(waiting).getByRole('button', { name: 'Withdraw' }))
    const confirm = await screen.findByRole('dialog', { name: 'Withdraw the invitation to dilan@example.org?' })
    await userEvent.click(within(confirm).getByRole('button', { name: 'Withdraw' }))
    await waitFor(() => expect(calls.withdrawn).toEqual(['7']))
  })
})

describe('Members: changing and removing', () => {
  it('changes a role and sends only a role the server allows (never owner)', async () => {
    mockMe()
    const calls = mockMembers()
    renderApp('/projects/12/members', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Change the role of Aras Kamal' }))
    const dialog = await screen.findByRole('dialog', { name: 'Change the role of Aras Kamal' })
    expect(within(dialog).queryByRole('radio', { name: /^Owner/ })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Change role' })).toBeDisabled()
    await userEvent.click(within(dialog).getByRole('radio', { name: /Viewer/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change role' }))
    await waitFor(() => expect(calls.patched).toEqual([{ id: '2', body: { role: 'viewer' } }]))
  })

  it('reports a role the server answered 200 for but did not keep', async () => {
    mockMe()
    mockMembers()
    server.use(http.patch('*/api/v1/projects/12/members/:userId', () => HttpResponse.json(envelope({ id: 2, user_id: 2, role: 'researcher', status: 'accepted' }))))
    renderApp('/projects/12/members', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Change the role of Aras Kamal' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('radio', { name: /Viewer/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change role' }))
    expect(await within(dialog).findByText(/did not keep/)).toBeInTheDocument()
  })

  it('states what removing does and does not do, then removes', async () => {
    mockMe()
    const calls = mockMembers()
    renderApp('/projects/12/members', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Aras Kamal' }))
    const dialog = await screen.findByRole('dialog', { name: 'Remove Aras Kamal from PRJ-0012?' })
    expect(within(dialog).getByText('Their access stops at once.')).toBeInTheDocument()
    expect(within(dialog).getByText(/not reassigned for you/)).toBeInTheDocument()
    expect(calls.removed).toEqual([])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove Aras Kamal' }))
    await waitFor(() => expect(calls.removed).toEqual(['2']))
  })

  it('offers a role change instead of removing', async () => {
    mockMe()
    mockMembers()
    renderApp('/projects/12/members', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Aras Kamal' }))
    await userEvent.click(await screen.findByRole('button', { name: /change their role instead/ }))
    expect(await screen.findByRole('dialog', { name: 'Change the role of Aras Kamal' })).toBeInTheDocument()
  })

  it('has no remove or change for the owner’s own row', async () => {
    mockMe()
    mockMembers()
    renderApp('/projects/12/members', { signedIn: true })
    await screen.findByText('Aras Kamal')
    expect(screen.queryByRole('button', { name: 'Remove Shilan Rashid' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Leave project' })).not.toBeInTheDocument()
  })
})

describe('Members: other roles', () => {
  it.each([
    ['researcher', asResearcher],
    ['viewer', asViewer],
  ])('a %s sees who is here but cannot invite, change or remove, and never asks for the invitations', async (_name, apis) => {
    mockMe()
    const calls = mockMembers(apis)
    renderApp('/projects/12/members', { signedIn: true })
    await screen.findByRole('table', { name: 'Project members' })
    expect(screen.getByText(/so you can see who is in the project but not change membership/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Invite member' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Remove / })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Change the role/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Invitations' })).not.toBeInTheDocument()
    expect(calls.invitationLists).toBe(0)
  })

  it('lets a member leave after confirming, and goes back to the project list', async () => {
    mockMe()
    const calls = mockMembers({
      ...asResearcher,
      members: [member({ id: 1, user_id: 2, role: 'owner', user: { id: 2, display_name: 'Aras Kamal' } }), member({ id: 5, user_id: 1, user: { id: 1, display_name: 'Shilan Rashid' } })],
    })
    server.use(http.get('*/api/v1/projects', () => HttpResponse.json(envelope([], { ...pg(0), counts: { owned: 0, shared: 0, archived: 0, trash: 0 } }))))
    const { router } = renderApp('/projects/12/members', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Leave project' }))
    const dialog = await screen.findByRole('dialog', { name: 'Leave PRJ-0012?' })
    expect(calls.left).toBe(0)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Leave project' }))
    await waitFor(() => expect(calls.left).toBe(1))
    await waitFor(() => expect(router.state.location.pathname).toBe('/projects'))
  })

  it('shows project not available for a project the person cannot open', async () => {
    mockMe()
    mockProjectApis(12, { detail: new Response(JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found.' } }), { status: 404 }) })
    renderApp('/projects/12/members', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'Project not available' })).toBeInTheDocument()
  })
})

describe('Invitation page', () => {
  const preview = (over: Record<string, unknown> = {}) => ({
    token: 'tok',
    project_id: 12,
    project_title: 'Chains of the wuḍūʾ reports',
    inviter: 'Shilan Rashid',
    role: 'researcher',
    status: 'pending',
    expires_at: '2099-01-01T00:00:00Z',
    is_expired: false,
    ...over,
  })

  it('shows only the title, who invited and the role, with what the role can and cannot do', async () => {
    mockMe()
    server.use(http.get('*/api/v1/invitations/tok', () => HttpResponse.json(envelope(preview()))))
    renderApp('/invitations/tok', { signedIn: true })
    expect(await screen.findByRole('heading', { level: 1, name: 'Shilan Rashid invited you to join a project' })).toBeInTheDocument()
    expect(screen.getByText('Chains of the wuḍūʾ reports')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'As a Researcher you can' })).toBeInTheDocument()
    const cannot = screen.getByRole('heading', { name: 'You cannot' }).nextElementSibling as HTMLElement
    expect(within(cannot).getByText('Manage members')).toBeInTheDocument()
    expect(within(cannot).queryByText('Discuss and comment')).not.toBeInTheDocument()
  })

  it('accepts, then opens the project', async () => {
    mockMe()
    let accepted = 0
    server.use(
      http.get('*/api/v1/invitations/tok', () => HttpResponse.json(envelope(preview()))),
      http.post('*/api/v1/invitations/tok/accept', () => {
        accepted++
        return HttpResponse.json(envelope({ id: 1, role: 'researcher', status: 'accepted' }))
      }),
    )
    mockProjectApis(12, { detail: projectDetail({ owner_id: 2, memberships: [{ user_id: 1, role: 'researcher', status: 'accepted' }] }) })
    const { router } = renderApp('/invitations/tok', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Accept and open project' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/projects/12/overview'))
    expect(accepted).toBe(1)
  })

  it('shows the server’s reason when the invitation was sent to another address, and stays on the page', async () => {
    mockMe()
    server.use(
      http.get('*/api/v1/invitations/tok', () => HttpResponse.json(envelope(preview()))),
      http.post('*/api/v1/invitations/tok/accept', () =>
        HttpResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'This invitation was sent to a different email address.' } }, { status: 403 }),
      ),
    )
    const { router } = renderApp('/invitations/tok', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Accept and open project' }))
    expect(await screen.findByText(/sent to a different email address/)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/invitations/tok')
  })

  it('declines and says nothing was shared', async () => {
    mockMe()
    let declined = 0
    server.use(
      http.get('*/api/v1/invitations/tok', () => HttpResponse.json(envelope(preview()))),
      http.post('*/api/v1/invitations/tok/decline', () => {
        declined++
        return HttpResponse.json(envelope(null))
      }),
    )
    renderApp('/invitations/tok', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Decline' }))
    expect(await screen.findByText(/You declined the invitation/)).toBeInTheDocument()
    expect(declined).toBe(1)
    expect(screen.queryByRole('button', { name: 'Accept and open project' })).not.toBeInTheDocument()
  })

  it('explains an expired invitation and offers no answer', async () => {
    mockMe()
    server.use(http.get('*/api/v1/invitations/tok', () => HttpResponse.json(envelope(preview({ is_expired: true })))))
    renderApp('/invitations/tok', { signedIn: true })
    expect(await screen.findByText(/This invitation has expired, so no access was given/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accept and open project' })).not.toBeInTheDocument()
  })

  it('looks the same for a link that does not exist as for one that was withdrawn', async () => {
    mockMe()
    server.use(http.get('*/api/v1/invitations/tok', () => HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Invitation not found.' } }, { status: 404 })))
    renderApp('/invitations/tok', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'This invitation is not available' })).toBeInTheDocument()
  })

  it('sends someone who is not signed in to sign in first', async () => {
    const { router } = renderApp('/invitations/tok')
    await waitFor(() => expect(router.state.location.pathname).toBe('/sign-in'))
    expect(router.state.location.state).toMatchObject({ from: '/invitations/tok' })
  })
})
