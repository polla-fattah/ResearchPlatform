import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { envelope, mockMe, renderApp } from '@/test/helpers'
import { server } from '@/test/server'

const pub = {
  public_slug: 'kufan-chains',
  title: 'Kufan chains of the wuḍūʾ reports',
  summary: 'We are comparing the 14 occurrences of the report across the six Sunan collections.',
  research_stage: 'analysing',
  keywords: [],
  published_at: '2026-10-01T10:00:00Z',
  project: { title: 'Chains', scope: 's', stage: 'analysing', owner: { display_name: 'Aras Kamal' } },
}

function mockInterest(o: { send?: () => Response | undefined } = {}) {
  const calls = { sent: [] as Record<string, unknown>[] }
  server.use(
    http.get('*/api/v1/public/announcements/kufan-chains', () => HttpResponse.json(envelope(pub))),
    http.post('*/api/v1/public/announcements/kufan-chains/collaboration-requests', async ({ request }) => {
      calls.sent.push((await request.json()) as Record<string, unknown>)
      return o.send?.() ?? HttpResponse.json(envelope({ id: 1 }), { status: 202 })
    }),
  )
  return calls
}

const fill = async (message = 'I have photographs of two Ibn Mājah manuscripts.') => {
  const form = await screen.findByRole('form', { name: 'Offer to collaborate' })
  await userEvent.type(within(form).getByLabelText(/How you could help/), message)
  return form
}

describe('Collaboration interest form', () => {
  it('asks a visitor to sign in first, and brings them back here afterwards', async () => {
    mockInterest()
    const { router } = renderApp('/announcements/kufan-chains/interest')
    const section = await screen.findByRole('region', { name: 'Sign in with an account to offer help' })
    expect(within(section).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in')
    expect(within(section).getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/apply')
    expect(screen.queryByRole('form', { name: 'Offer to collaborate' })).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/announcements/kufan-chains/interest')
  })

  it('shows what the owner will see about the person, including the account e-mail address', async () => {
    mockMe()
    mockInterest()
    renderApp('/announcements/kufan-chains/interest', { signedIn: true })
    const form = await screen.findByRole('form', { name: 'Offer to collaborate' })
    expect(within(form).getByText('Shilan Rashid')).toBeInTheDocument()
    expect(within(form).getByText('shilan@example.org')).toBeInTheDocument()
    expect(within(form).getByText(/shared with Aras Kamal/)).toBeInTheDocument()
    expect(within(form).getByText(/Sending does not give you access to the project/)).toBeInTheDocument()
  })

  it('does not send a short message or without consent', async () => {
    mockMe()
    const calls = mockInterest()
    renderApp('/announcements/kufan-chains/interest', { signedIn: true })
    const form = await fill('too short')
    await userEvent.click(within(form).getByRole('button', { name: 'Send request' }))
    expect(await within(form).findByText('Write at least 10 characters')).toBeInTheDocument()
    expect(within(form).getByText('Agree to share these details to send the request')).toBeInTheDocument()
    expect(calls.sent).toEqual([])
  })

  it('sends the name, e-mail, affiliation, message and a consent that is true, then says what was shared', async () => {
    mockMe({ profile: { affiliation: 'Soran University' } })
    const calls = mockInterest()
    renderApp('/announcements/kufan-chains/interest', { signedIn: true })
    const form = await fill()
    await userEvent.click(within(form).getByRole('checkbox'))
    await userEvent.click(within(form).getByRole('button', { name: 'Send request' }))
    await waitFor(() =>
      expect(calls.sent).toEqual([
        { name: 'Shilan Rashid', email: 'shilan@example.org', affiliation: 'Soran University', message: 'I have photographs of two Ibn Mājah manuscripts.', consent: true },
      ]),
    )
    expect(await screen.findByRole('status', { name: 'Request sent to Aras Kamal' })).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Offer to collaborate' })).not.toBeInTheDocument()
  })

  it('keeps the message and says the call closed when the announcement is gone while writing', async () => {
    mockMe()
    mockInterest({ send: () => HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'No query results' } }, { status: 404 }) })
    renderApp('/announcements/kufan-chains/interest', { signedIn: true })
    const form = await fill()
    await userEvent.click(within(form).getByRole('checkbox'))
    await userEvent.click(within(form).getByRole('button', { name: 'Send request' }))
    expect(await screen.findByText('This call closed while you were writing')).toBeInTheDocument()
    expect(within(form).getByLabelText(/How you could help/)).toHaveValue('I have photographs of two Ibn Mājah manuscripts.')
  })

  it('keeps the message and says it was not sent when the server fails', async () => {
    mockMe()
    mockInterest({ send: () => HttpResponse.json({ success: false, error: { code: 'ERROR', message: 'boom' } }, { status: 500 }) })
    renderApp('/announcements/kufan-chains/interest', { signedIn: true })
    const form = await fill()
    await userEvent.click(within(form).getByRole('checkbox'))
    await userEvent.click(within(form).getByRole('button', { name: 'Send request' }))
    expect(await screen.findByText(/The request was not sent/)).toBeInTheDocument()
    expect(within(form).getByLabelText(/How you could help/)).toHaveValue('I have photographs of two Ibn Mājah manuscripts.')
    expect(screen.queryByText(/boom/)).not.toBeInTheDocument()
  })

  it('shows the announcement is gone for an address that is not published', async () => {
    mockMe()
    server.use(http.get('*/api/v1/public/announcements/kufan-chains', () => HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'x' } }, { status: 404 })))
    renderApp('/announcements/kufan-chains/interest', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'This announcement is no longer available' })).toBeInTheDocument()
  })
})
