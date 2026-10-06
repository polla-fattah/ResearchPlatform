import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '@/test/server'
import { envelope, mockHomeApis, mockMe, renderApp } from '@/test/helpers'
import { mockProjectApis } from '@/test/projectMocks'
import { isReleaseEnabled } from './features'
import { SCREENS } from './screens'

describe('route guards', () => {
  it('sends anonymous visitors to sign-in', async () => {
    const { router } = renderApp('/home')
    await waitFor(() => expect(router.state.location.pathname).toBe('/sign-in'))
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('limits pending applicants to the status page (ACC-03)', async () => {
    mockMe({ status: 'pending' })
    server.use(
      http.get('*/api/v1/applications/my-status', () =>
        HttpResponse.json(envelope({ user_status: 'pending', application: null })),
      ),
    )
    const { router } = renderApp('/projects', { signedIn: true })
    await waitFor(() => expect(router.state.location.pathname).toBe('/status'))
    expect(await screen.findByText(/aren't open to you yet/i)).toBeInTheDocument()
  })

  it('opens researcher screens for approved accounts', async () => {
    mockMe()
    mockHomeApis()
    renderApp('/home', { signedIn: true })
    expect(await screen.findByRole('heading', { name: /welcome back, shilan rashid/i })).toBeInTheDocument()
    expect(screen.getByText(/Signed in as Shilan Rashid/)).toBeInTheDocument()
  })

  it('shows the not-available page for /admin to non-admins', async () => {
    mockMe()
    renderApp('/admin/applications', { signedIn: true })
    expect(await screen.findByRole('heading', { name: /isn't available/i })).toBeInTheDocument()
  })

  it('opens /admin for admins', async () => {
    mockMe({ is_admin: true })
    renderApp('/admin/applications', { signedIn: true })
    expect(await screen.findByRole('heading', { level: 1, name: 'Applications' })).toBeInTheDocument()
  })

  it('returns to sign-in when the session expires (401)', async () => {
    server.use(
      http.get('*/api/v1/auth/me', () => HttpResponse.json({ message: 'Unauthenticated.' }, { status: 401 })),
    )
    const { router } = renderApp('/home', { signedIn: true })
    await waitFor(() => expect(router.state.location.pathname).toBe('/sign-in'))
  })
})

describe('shell', () => {
  it('shows a built screen as a link whatever release it belongs to', async () => {
    mockMe()
    mockProjectApis()
    renderApp('/projects/12', { signedIn: true })
    await screen.findByText('PRJ-0012')
    expect(screen.getByRole('link', { name: 'Activity' })).toHaveAttribute('href', '/projects/12/activity')
    expect(screen.getByRole('link', { name: 'Review & Publication' })).toHaveAttribute('href', '/projects/12/submission')
  })

  it('shows an area that is not built yet disabled with its release tag', async () => {
    expect(isReleaseEnabled('R1b', 'R1a')).toBe(false)
    expect(isReleaseEnabled('R2', 'R1c')).toBe(false)
  })

  it('shows the number of unread notifications beside Notifications, and nothing when there are none', async () => {
    mockMe()
    mockHomeApis({ unread: 3 })
    renderApp('/home', { signedIn: true })
    await screen.findByRole('heading', { name: /welcome back/i })
    const link = await screen.findByRole('link', { name: /Notifications/ })
    expect(link).toHaveAttribute('href', '/notifications')
    await waitFor(() => expect(link).toHaveTextContent('3'))
  })

  it('renders the project tab bar with the display code', async () => {
    mockMe()
    mockProjectApis()
    renderApp('/projects/12', { signedIn: true })
    expect(await screen.findByText('PRJ-0012')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Evidence' })).toHaveAttribute('href', '/projects/12/evidence')
  })
})

describe('registry and flags', () => {
  it('registers all 41 mockups plus the two account/public list variants', () => {
    const ids = new Set(SCREENS.map((s) => s.id))
    for (const id of ['01', '02', '03', '03b', '14', '40']) expect(ids.has(id)).toBe(true)
    expect(SCREENS.filter((s) => !/[a-z]$/.test(s.id) || s.id === '03b').length).toBe(41)
  })

  it('enables releases in order', () => {
    expect(isReleaseEnabled('R1a', 'R1a')).toBe(true)
    expect(isReleaseEnabled('R1b', 'R1a')).toBe(false)
    expect(isReleaseEnabled('R1b', 'R1c')).toBe(true)
  })
})
