import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { envelope, mockMe, renderApp } from '@/test/helpers'
import { mockProjectApis, projectDetail } from '@/test/projectMocks'
import { server } from '@/test/server'

const request = (over: Record<string, unknown> = {}) => ({
  id: 5,
  project_id: 12,
  requester_id: 9,
  message: 'I have photographs of two Ibn Mājah manuscripts. [From: Leyla Mustafa (leyla@example.org)]',
  contact_email: 'leyla@example.org',
  status: 'pending',
  decision_notes: null,
  created_at: '2026-10-03T09:00:00Z',
  requester: { id: 9, display_name: 'Leyla Mustafa', email: 'leyla@example.org', is_admin: false, roles: ['applicant'], mfa_enabled: false },
  ...over,
})

function mockRequests(items: Record<string, unknown>[] = [request(), request({ id: 6, status: 'declined', decision_notes: 'Out of scope', message: 'Another offer.', requester: { id: 10, display_name: 'Bawan Faraj' }, contact_email: 'bawan@example.org' })], detail: Record<string, unknown> = projectDetail()) {
  const calls = { declined: [] as { id: string; body: Record<string, unknown> }[], invited: [] as Record<string, unknown>[], requestsListed: 0 }
  mockProjectApis(12, { detail })
  server.use(
    http.get('*/api/v1/projects/12/members', () => HttpResponse.json(envelope([{ id: 1, user_id: 1, role: 'owner', status: 'accepted', user: { id: 1, display_name: 'Shilan Rashid' } }]))),
    http.get('*/api/v1/projects/12/invitations', () => HttpResponse.json(envelope([], { pagination: { current_page: 1, per_page: 50, total_items: 0, total_pages: 1, has_more: false } }))),
    http.get('*/api/v1/projects/12/collaboration-requests', () => {
      calls.requestsListed++
      return HttpResponse.json(envelope(items))
    }),
    http.patch('*/api/v1/projects/12/collaboration-requests/:id', async ({ request: r, params }) => {
      const body = (await r.json()) as Record<string, unknown>
      calls.declined.push({ id: String(params.id), body })
      return HttpResponse.json(envelope({ id: Number(params.id), status: body.status, decision_notes: body.decision_notes ?? null }))
    }),
    http.post('*/api/v1/projects/12/invitations', async ({ request: r }) => {
      const body = (await r.json()) as Record<string, unknown>
      calls.invited.push(body)
      return HttpResponse.json(envelope({ id: 8, email: body.email, role: body.role, token: 'tok', status: 'pending' }), { status: 201 })
    }),
  )
  return calls
}

describe('Collaboration requests (owner inbox, on the members screen)', () => {
  it('lists who asked with their message and state, and never shows the account details the server embeds', async () => {
    mockMe()
    mockRequests()
    renderApp('/projects/12/members', { signedIn: true })
    const list = await screen.findByRole('list', { name: 'Collaboration requests' })
    expect(within(list).getByText('Leyla Mustafa')).toBeInTheDocument()
    expect(within(list).getByText('Waiting for you')).toBeInTheDocument()
    expect(within(list).getByText('Declined')).toBeInTheDocument()
    expect(within(list).getByText(/Your note/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/applicant|mfa_enabled/)
  })

  it('offers invite and decline only on a waiting request', async () => {
    mockMe()
    mockRequests()
    renderApp('/projects/12/members', { signedIn: true })
    const list = await screen.findByRole('list', { name: 'Collaboration requests' })
    const rows = within(list).getAllByRole('listitem')
    expect(within(rows[0]!).getByRole('button', { name: 'Invite…' })).toBeInTheDocument()
    expect(within(rows[0]!).getByRole('button', { name: 'Decline' })).toBeInTheDocument()
    expect(within(rows[1]!).queryByRole('button')).not.toBeInTheDocument()
  })

  it('accepts by inviting the address they gave: the invitation dialog opens with it filled in, and nothing is marked accepted', async () => {
    mockMe()
    const calls = mockRequests()
    renderApp('/projects/12/members', { signedIn: true })
    const list = await screen.findByRole('list', { name: 'Collaboration requests' })
    await userEvent.click(within(within(list).getAllByRole('listitem')[0]!).getByRole('button', { name: 'Invite…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Invite to PRJ-0012' })
    expect(within(dialog).getByLabelText(/E-mail address/)).toHaveValue('leyla@example.org')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send invitation' }))
    await waitFor(() => expect(calls.invited).toEqual([{ email: 'leyla@example.org', role: 'researcher', expires_days: 14 }]))
    expect(calls.declined).toEqual([])
  })

  it('declines with a note, and sends the decline and nothing that would add the person', async () => {
    mockMe()
    const calls = mockRequests()
    renderApp('/projects/12/members', { signedIn: true })
    const list = await screen.findByRole('list', { name: 'Collaboration requests' })
    await userEvent.click(within(within(list).getAllByRole('listitem')[0]!).getByRole('button', { name: 'Decline' }))
    const dialog = await screen.findByRole('dialog', { name: /Decline the request from Leyla Mustafa/ })
    await userEvent.type(within(dialog).getByLabelText(/A note for yourself/), 'Out of scope')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Decline' }))
    await waitFor(() => expect(calls.declined).toEqual([{ id: '5', body: { status: 'declined', decision_notes: 'Out of scope' } }]))
  })

  it('says so when there are none', async () => {
    mockMe()
    mockRequests([])
    renderApp('/projects/12/members', { signedIn: true })
    expect(await screen.findByText(/No requests yet/)).toBeInTheDocument()
  })

  it('is not shown, and not asked for, to anyone but the owner', async () => {
    mockMe()
    const calls = mockRequests([request()], projectDetail({ owner_id: 2, owner: { id: 2, display_name: 'Aras Kamal' }, memberships: [{ user_id: 1, role: 'researcher', status: 'accepted' }] }))
    renderApp('/projects/12/members', { signedIn: true })
    await screen.findByRole('table', { name: 'Project members' })
    expect(screen.queryByRole('list', { name: 'Collaboration requests' })).not.toBeInTheDocument()
    expect(calls.requestsListed).toBe(0)
  })
})
