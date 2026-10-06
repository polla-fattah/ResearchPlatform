import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { session } from '@/api/http'
import { envelope, mockMe, renderApp } from '@/test/helpers'
import { server } from '@/test/server'

const errorBody = (code: string, message: string, details: unknown = []) => ({
  success: false,
  error: { code, message, details },
})

async function fillApply(opts: { email?: string; password?: string; confirm?: string } = {}) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/display name/i), 'Shilan Rashid')
  await user.type(screen.getByLabelText(/^email/i), opts.email ?? 'shilan@example.org')
  await user.type(screen.getByLabelText(/^password/i), opts.password ?? 'correct horse')
  await user.type(screen.getByLabelText(/confirm password/i), opts.confirm ?? opts.password ?? 'correct horse')
  await user.type(screen.getByLabelText(/research interests/i), 'Takhrīj of ritual purity reports')
  await user.selectOptions(screen.getByLabelText(/preferred language/i), 'ckb')
  return user
}

describe('Apply (01)', () => {
  it('lists every problem, keeps the answers, and shows inline errors', async () => {
    renderApp('/apply')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/display name/i), 'Shilan Rashid')
    await user.type(screen.getByLabelText(/^email/i), 'shilan@example')
    await user.click(screen.getByRole('button', { name: /submit application/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/fix \d+ fields to continue/i)
    expect(alert).toHaveTextContent(/email: enter a full address/i)
    expect(alert).toHaveTextContent(/research interests: add at least one/i)
    expect(alert).toHaveTextContent(/other answers are saved/i)
    expect(screen.getByLabelText(/display name/i)).toHaveValue('Shilan Rashid')
    expect(screen.getByLabelText(/^email/i)).toHaveValue('shilan@example')
  })

  it('checks that the two passwords match', async () => {
    renderApp('/apply')
    const user = await fillApply({ password: 'correct horse', confirm: 'different' })
    await user.click(screen.getByRole('button', { name: /submit application/i }))
    expect(await screen.findByText(/the two passwords don't match/i, { selector: 'span' })).toBeInTheDocument()
  })

  it('sends one apply call, starts a session, and waits for the verification email', async () => {
    let body: Record<string, unknown> | undefined
    server.use(
      http.post('*/api/v1/applications', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(
          envelope(
            {
              user: { id: 7, display_name: 'Shilan Rashid', email: 'shilan@example.org', status: 'pending' },
              application: { id: 3, reference: 'APP-2026-0007', status: 'pending' },
              token: 'new-token',
            },
          ),
          { status: 201 },
        )
      }),
    )
    mockMe({ status: 'pending' })

    const { router } = renderApp('/apply')
    const user = await fillApply()
    await user.click(screen.getByRole('button', { name: /submit application/i }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/apply/check-email'))
    expect(await screen.findByRole('heading', { name: /check your email/i })).toBeInTheDocument()
    expect(screen.getByText(/shilan@example\.org/)).toBeInTheDocument()
    expect(session.get()).toBe('new-token')
    expect(body).toMatchObject({
      display_name: 'Shilan Rashid',
      email: 'shilan@example.org',
      password: 'correct horse',
      password_confirmation: 'correct horse',
      research_interests: 'Takhrīj of ritual purity reports',
      preferred_language: 'ckb',
    })
    expect(body).not.toHaveProperty('affiliation') // empty optional fields are not sent
  })

  it('puts a server-side field error on its input and keeps everything typed', async () => {
    server.use(
      http.post('*/api/v1/applications', () =>
        HttpResponse.json(
          errorBody('VALIDATION_ERROR', 'The email has already been taken.', {
            email: ['The email has already been taken.'],
          }),
          { status: 422 },
        ),
      ),
    )
    renderApp('/apply')
    const user = await fillApply()
    await user.click(screen.getByRole('button', { name: /submit application/i }))

    expect(await screen.findByText('The email has already been taken.', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByLabelText(/display name/i)).toHaveValue('Shilan Rashid')
    expect(screen.getByLabelText(/research interests/i)).toHaveValue('Takhrīj of ritual purity reports')
    expect(session.get()).toBeNull()
  })

  it('shows "How access works" with the first step current', () => {
    renderApp('/apply')
    expect(screen.getByRole('complementary', { name: /how access works/i })).toBeInTheDocument()
    expect(screen.getByText('Apply', { selector: 'li *, li' })).toBeTruthy()
  })
})

describe('Check your email', () => {
  it('limits resends to once a minute and shows how many are used today', async () => {
    mockMe({ status: 'unverified' })
    server.use(
      http.get('*/api/v1/applications/my-status', () =>
        HttpResponse.json(envelope({ user_status: 'unverified', application: null })),
      ),
      http.post('*/api/v1/auth/email/resend', () =>
        HttpResponse.json(envelope({ remaining_today: 3 })),
      ),
    )
    renderApp('/status', { signedIn: true })
    const resend = await screen.findByRole('button', { name: /resend link/i })
    expect(resend).toBeEnabled()
    const user = userEvent.setup()
    await user.click(resend)

    expect(await screen.findByText(/available in 1:00/i)).toBeInTheDocument()
    expect(screen.getByText(/2 of 5 used today/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resend link/i })).toBeDisabled()
  })

  it('uses the wait the server asks for after a 429', async () => {
    mockMe({ status: 'unverified' })
    server.use(
      http.post('*/api/v1/auth/email/resend', () =>
        HttpResponse.json(errorBody('RATE_LIMITED', 'Please wait.', { retry_after: 45 }), { status: 429 }),
      ),
    )
    renderApp('/status', { signedIn: true })
    await userEvent.setup().click(await screen.findByRole('button', { name: /resend link/i }))
    expect(await screen.findByText(/available in 0:45/i)).toBeInTheDocument()
  })

  it('redirects to Apply when there is no email to show', async () => {
    const { router } = renderApp('/apply/check-email')
    await waitFor(() => expect(router.state.location.pathname).toBe('/apply'))
  })
})

describe('Verify email', () => {
  it('verifies once and moves the applicant to the review step', async () => {
    let calls = 0
    server.use(
      http.post('*/api/v1/auth/email/verify', async ({ request }) => {
        calls += 1
        expect(await request.json()).toEqual({ token: 'abc123' })
        return HttpResponse.json(envelope(null))
      }),
    )
    renderApp('/verify-email?token=abc123')
    expect(await screen.findByRole('heading', { name: /email verified/i })).toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/sign-in')
    expect(calls).toBe(1)
  })

  it('explains an expired or used link and offers a new one', async () => {
    server.use(
      http.post('*/api/v1/auth/email/verify', () =>
        HttpResponse.json(errorBody('GONE', 'Verification token is expired or invalid.'), { status: 410 }),
      ),
      http.post('*/api/v1/auth/email/resend', () => HttpResponse.json(envelope({ remaining_today: 4 }))),
    )
    renderApp('/verify-email?token=old')
    expect(await screen.findByRole('heading', { name: /this link no longer works/i })).toBeInTheDocument()
    expect(screen.getByText(/nothing changed in your application/i)).toBeInTheDocument()

    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/email/i), 'shilan@example.org')
    await user.click(screen.getByRole('button', { name: /send a new link/i }))
    expect(await screen.findByText(/a new link is on its way/i)).toBeInTheDocument()
  })

  it('treats a missing token as an unusable link', async () => {
    renderApp('/verify-email')
    expect(await screen.findByRole('heading', { name: /this link no longer works/i })).toBeInTheDocument()
  })
})

describe('Sign in', () => {
  async function signIn() {
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/^email/i), 'shilan@example.org')
    await user.type(screen.getByLabelText(/^password/i), 'wrong password')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))
  }

  it('says the email or password does not match, and mentions the pause rule', async () => {
    server.use(
      http.post('*/api/v1/auth/login', () =>
        HttpResponse.json(errorBody('INVALID_CREDENTIALS', 'Invalid email or password credentials.'), {
          status: 401,
        }),
      ),
    )
    renderApp('/sign-in')
    await signIn()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/email or password doesn't match/i)
    expect(alert).toHaveTextContent(/after 5 failed attempts, sign-in pauses for 15 minutes/i)
    expect(screen.getByLabelText(/^email/i)).toHaveValue('shilan@example.org')
  })

  it('shows how long sign-in is paused after too many attempts', async () => {
    server.use(
      http.post('*/api/v1/auth/login', () =>
        HttpResponse.json(errorBody('RATE_LIMITED', 'Too many.', { retry_after: 840 }), {
          status: 429,
          headers: { 'Retry-After': '840' },
        }),
      ),
    )
    renderApp('/sign-in')
    await signIn()
    expect(await screen.findByRole('alert')).toHaveTextContent(/try again in 14 minutes/i)
  })

  it('reports a suspended account', async () => {
    server.use(
      http.post('*/api/v1/auth/login', () =>
        HttpResponse.json(errorBody('ACCOUNT_SUSPENDED', 'Suspended.'), { status: 403 }),
      ),
    )
    renderApp('/sign-in')
    await signIn()
    expect(await screen.findByRole('alert')).toHaveTextContent(/account is suspended/i)
  })

  it('does not pretend to support two-factor sign-in (request file C-4)', async () => {
    server.use(
      http.post('*/api/v1/auth/login', () =>
        HttpResponse.json(envelope({ mfa_required: true, challenge_token: 'c' })),
      ),
    )
    renderApp('/sign-in')
    await signIn()
    expect(await screen.findByRole('alert')).toHaveTextContent(/two-factor sign-in, which isn't available/i)
    expect(session.get()).toBeNull()
  })

  it('signs in and returns to the page the visitor wanted', async () => {
    server.use(
      http.post('*/api/v1/auth/login', () =>
        HttpResponse.json(
          envelope({
            user: { id: 1, display_name: 'Shilan Rashid', email: 'shilan@example.org', status: 'approved' },
            token: 'tok',
          }),
        ),
      ),
    )
    mockMe()
    const { router } = renderApp({ pathname: '/sign-in', state: { from: '/library' } })
    await signIn()
    await waitFor(() => expect(router.state.location.pathname).toBe('/library'))
    expect(session.get()).toBe('tok')
  })

  it('says "You were signed out" after a session expired', async () => {
    session.markExpired()
    renderApp('/sign-in')
    expect(screen.getByText(/you were signed out/i)).toBeInTheDocument()
    expect(screen.getByText(/unsaved editor text is kept as a local draft/i)).toBeInTheDocument()
  })

  it('links to recovery and to Apply', () => {
    renderApp('/sign-in')
    expect(screen.getByRole('link', { name: /forgot password/i })).toHaveAttribute('href', '/recover')
    expect(screen.getByRole('link', { name: /apply for access/i })).toHaveAttribute('href', '/apply')
  })
})

describe('Recover password', () => {
  it('never reveals whether the address has an account', async () => {
    server.use(http.post('*/api/v1/auth/password/forgot', () => HttpResponse.json(envelope(null))))
    renderApp('/recover')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/email/i), 'someone@example.org')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))
    expect(await screen.findByText(/if an account uses someone@example\.org/i)).toBeInTheDocument()
    expect(screen.getByText(/expires in 1 hour/i)).toBeInTheDocument()
  })

  it('shows the wait after too many requests and keeps the email', async () => {
    server.use(
      http.post('*/api/v1/auth/password/forgot', () =>
        HttpResponse.json(errorBody('RATE_LIMITED', 'Too many.', { retry_after: 600 }), { status: 429 }),
      ),
    )
    renderApp('/recover')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/email/i), 'someone@example.org')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/try again in 10 minutes/i)
    expect(screen.getByLabelText(/email/i)).toHaveValue('someone@example.org')
  })
})

describe('Choose a new password', () => {
  it('sets the password from the emailed link', async () => {
    let body: unknown
    server.use(
      http.post('*/api/v1/auth/password/reset', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(envelope(null))
      }),
    )
    renderApp('/recover/reset?token=t0k&email=a%40b.org')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/^new password/i), 'a brand new secret')
    await user.type(screen.getByLabelText(/confirm password/i), 'a brand new secret')
    await user.click(screen.getByRole('button', { name: /set new password/i }))
    expect(await screen.findByRole('heading', { name: /password changed/i })).toBeInTheDocument()
    expect(body).toEqual({
      email: 'a@b.org',
      token: 't0k',
      password: 'a brand new secret',
      password_confirmation: 'a brand new secret',
    })
  })

  it('explains an invalid or expired link', async () => {
    server.use(
      http.post('*/api/v1/auth/password/reset', () =>
        HttpResponse.json(errorBody('VALIDATION_ERROR', 'Password reset token is invalid or has expired.'), {
          status: 422,
        }),
      ),
    )
    renderApp('/recover/reset?token=bad&email=a%40b.org')
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/^new password/i), 'a brand new secret')
    await user.type(screen.getByLabelText(/confirm password/i), 'a brand new secret')
    await user.click(screen.getByRole('button', { name: /set new password/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/reset link doesn't work/i)
  })
})

describe('Application status', () => {
  const status = (application: Record<string, unknown> | null, user_status = 'pending') =>
    server.use(
      http.get('*/api/v1/applications/my-status', () =>
        HttpResponse.json(envelope({ user_status, application })),
      ),
    )

  const base = {
    id: 3,
    reference: 'APP-2026-0007',
    submitted_at: '2026-10-02T14:08:00Z',
    decision_reason: null,
    decided_at: null,
    information_request: null,
    replies: [],
  }

  it('shows a pending application with its reference and details', async () => {
    mockMe({
      status: 'pending',
      profile: { affiliation: null, research_interests: ['Takhrīj', 'Kufan narrators'] },
      preferred_language: 'ckb',
    })
    status({ ...base, status: 'pending' })
    renderApp('/status', { signedIn: true })
    expect(await screen.findByRole('heading', { name: /your application is under review/i })).toBeInTheDocument()
    expect(screen.getByText(/APP-2026-0007/)).toBeInTheDocument()
    expect(screen.getByText('Takhrīj, Kufan narrators')).toBeInTheDocument()
    expect(screen.getByText('Not provided (optional)')).toBeInTheDocument()
  })

  it('shows the administrator question and keeps the reply when sending fails', async () => {
    mockMe({ status: 'pending' })
    status({
      ...base,
      status: 'information_requested',
      information_request: {
        message: 'Could you describe a recent piece of hadith research you worked on?',
        requested_at: '2026-10-03T09:30:00Z',
        deadline: '2026-10-10T09:30:00Z',
      },
    })
    server.use(
      http.post('*/api/v1/applications/respond', () =>
        HttpResponse.json(errorBody('ERROR', 'Server unavailable.'), { status: 500 }),
      ),
    )
    renderApp('/status', { signedIn: true })
    expect(await screen.findByRole('heading', { name: /asked for more information/i })).toBeInTheDocument()
    expect(screen.getByText(/describe a recent piece of hadith research/i)).toBeInTheDocument()

    const user = userEvent.setup()
    const reply = screen.getByLabelText(/your reply/i)
    const send = screen.getByRole('button', { name: /send reply/i })
    expect(send).toBeDisabled() // too short
    await user.type(reply, 'I am comparing the Kufan chains of the wuḍūʾ reports.')
    await user.click(send)

    expect(await screen.findByRole('alert')).toHaveTextContent(/your reply wasn't sent/i)
    expect(screen.getByLabelText(/your reply/i)).toHaveValue('I am comparing the Kufan chains of the wuḍūʾ reports.')
  })

  it('sends the reply and goes back to the review queue', async () => {
    mockMe({ status: 'pending' })
    let answered = false
    server.use(
      http.get('*/api/v1/applications/my-status', () =>
        HttpResponse.json(
          envelope({
            user_status: 'pending',
            application: answered
              ? { ...base, status: 'pending' }
              : { ...base, status: 'information_requested', information_request: { message: 'Tell us more.' } },
          }),
        ),
      ),
      http.post('*/api/v1/applications/respond', async ({ request }) => {
        expect(await request.json()).toEqual({ message: 'Here is more detail.' })
        answered = true
        return HttpResponse.json(envelope({ id: 1 }))
      }),
    )
    renderApp('/status', { signedIn: true })
    await screen.findByRole('heading', { name: /asked for more information/i })
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/your reply/i), 'Here is more detail.')
    await user.click(screen.getByRole('button', { name: /send reply/i }))
    expect(await screen.findByRole('heading', { name: /your application is under review/i })).toBeInTheDocument()
  })

  it('shows the reason for a rejection and lets the applicant ask to reconsider', async () => {
    mockMe({ status: 'rejected' })
    status(
      {
        ...base,
        status: 'rejected',
        decision_reason: 'The information request got no reply within 14 days.',
        decided_at: '2026-10-04T11:02:00Z',
      },
      'rejected',
    )
    renderApp('/status', { signedIn: true })
    expect(await screen.findByRole('heading', { name: /wasn't approved/i })).toBeInTheDocument()
    expect(screen.getByText(/no reply within 14 days/i)).toBeInTheDocument()
    expect(screen.getByText(/same account, so there's no need to apply again/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/reply and ask us to reconsider/i)).toBeInTheDocument()
  })

  it('welcomes an approved account', async () => {
    mockMe({ status: 'approved' })
    status({ ...base, status: 'approved', decided_at: '2026-10-04T11:02:00Z' }, 'approved')
    renderApp('/status', { signedIn: true })
    expect(await screen.findByRole('heading', { name: /you're approved/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /go to your home/i })).toHaveAttribute('href', '/home')
  })

  it('explains a suspended account', async () => {
    mockMe({ status: 'suspended' })
    status({ ...base, status: 'approved' }, 'suspended')
    renderApp('/status', { signedIn: true })
    expect(await screen.findByRole('heading', { name: /account is suspended/i })).toBeInTheDocument()
  })

  it('names the screen a pending applicant tried to open', async () => {
    mockMe({ status: 'pending' })
    status({ ...base, status: 'pending' })
    const { router } = renderApp('/projects', { signedIn: true })
    await waitFor(() => expect(router.state.location.pathname).toBe('/status'))
    expect(await screen.findByText(/you tried to open projects/i)).toBeInTheDocument()
  })

  it('shows a retry when the status cannot be loaded', async () => {
    mockMe({ status: 'pending' })
    server.use(http.get('*/api/v1/applications/my-status', () => HttpResponse.error()))
    renderApp('/status', { signedIn: true })
    expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('redirects a signed-in visitor from Apply to the status page', async () => {
    mockMe({ status: 'pending' })
    status({ ...base, status: 'pending' })
    const { router } = renderApp('/apply', { signedIn: true })
    await waitFor(() => expect(router.state.location.pathname).toBe('/status'))
  })
})
