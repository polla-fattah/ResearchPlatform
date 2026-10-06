import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { envelope, mockMe, renderApp } from '@/test/helpers'
import { server } from '@/test/server'

const pg = (n: number, page = 1, perPage = 12) => ({ pagination: { current_page: page, per_page: perPage, total_items: n, total_pages: Math.max(1, Math.ceil(n / perPage)), has_more: page * perPage < n } })

const pub = (over: Record<string, unknown> = {}) => ({
  id: 3,
  project_id: 12,
  public_slug: 'kufan-chains',
  title: 'Kufan chains of the wuḍūʾ reports',
  summary: 'We are comparing the 14 occurrences of the report across the six Sunan collections.',
  research_stage: 'analysing',
  keywords: ['wuḍūʾ', 'isnād'],
  status: 'published',
  published_at: '2026-10-01T10:00:00Z',
  project: { id: 12, title: 'Chains of the wuḍūʾ reports', scope: 'Six Sunan collections', stage: 'analysing', owner: { id: 1, display_name: 'Shilan Rashid', affiliation: 'Soran University' } },
  ...over,
})

function mockPublic(items: Record<string, unknown>[] = [pub(), pub({ id: 4, public_slug: 'niyyah', title: 'The niyyah tradition', summary: 'A short one.' })]) {
  const calls = { queries: [] as URLSearchParams[], headers: [] as (string | null)[] }
  server.use(
    http.get('*/api/v1/public/announcements', ({ request }) => {
      calls.queries.push(new URL(request.url).searchParams)
      calls.headers.push(request.headers.get('authorization'))
      return HttpResponse.json(envelope(items, pg(items.length)))
    }),
    http.get('*/api/v1/public/announcements/:slug', ({ params }) => {
      const found = items.find((i) => i.public_slug === params.slug)
      return found ? HttpResponse.json(envelope(found)) : HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Announcement not found.' } }, { status: 404 })
    }),
  )
  return calls
}

describe('Public announcements list', () => {
  it('lists published announcements for someone who is not signed in, with no credentials sent', async () => {
    const calls = mockPublic()
    renderApp('/announcements')
    const list = await screen.findByRole('list', { name: 'Research announcements' })
    expect(within(list).getByRole('link', { name: 'Kufan chains of the wuḍūʾ reports' })).toHaveAttribute('href', '/announcements/kufan-chains')
    expect(within(list).getAllByText('Announcement · ongoing · not peer-reviewed')).toHaveLength(2)
    expect(within(list).getAllByText(/Shilan Rashid/)).toHaveLength(2)
    expect(calls.headers[0]).toBeNull()
  })

  it('never shows anything the public answer should not have carried', async () => {
    mockPublic([pub({ owner_email: 'secret@example.org', is_admin: true, project: { title: 'P', scope: 's', stage: 'analysing', owner: { display_name: 'Shilan', email: 'secret@example.org', is_admin: true } } })])
    renderApp('/announcements')
    await screen.findByRole('list', { name: 'Research announcements' })
    expect(document.body.textContent).not.toContain('secret@example.org')
  })

  it('filters by words and stage on the server, with both in the address', async () => {
    const calls = mockPublic()
    const { router } = renderApp('/announcements')
    await screen.findByRole('list', { name: 'Research announcements' })
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'ʿilal{Enter}')
    await userEvent.selectOptions(screen.getByLabelText('Stage'), 'Writing')
    await waitFor(() => {
      const q = calls.queries.at(-1)!
      expect(q.get('q')).toBe('ʿilal')
      expect(q.get('research_stage')).toBe('writing')
    })
    expect(router.state.location.search).toBe('?q=%CA%BFilal&stage=writing')
  })

  it('says there is nothing, and when the filters match nothing', async () => {
    mockPublic([])
    renderApp('/announcements')
    expect(await screen.findByText('No announcements yet')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Stage'), 'Writing')
    expect(await screen.findByText(/No announcements match/)).toBeInTheDocument()
  })

  it('shows an error with a retry when the list cannot load', async () => {
    server.use(http.get('*/api/v1/public/announcements', () => HttpResponse.json({ success: false, error: { code: 'ERROR', message: 'x' } }, { status: 500 })))
    renderApp('/announcements')
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('is reachable from the public header', async () => {
    mockPublic()
    renderApp('/announcements')
    expect((await screen.findAllByRole('link', { name: 'Announcements' }))[0]).toHaveAttribute('href', '/announcements')
  })
})

describe('Public announcement page', () => {
  it('shows the announcement, labelled as ongoing research that is not a finding', async () => {
    mockPublic()
    renderApp('/announcements/kufan-chains')
    expect(await screen.findByRole('heading', { level: 1, name: 'Kufan chains of the wuḍūʾ reports' })).toBeInTheDocument()
    expect(screen.getByText(/not been peer-reviewed, and it is not a finding/)).toBeInTheDocument()
    expect(screen.getByText('Six Sunan collections')).toBeInTheDocument()
    expect(screen.getByText('Analysing')).toBeInTheDocument()
    expect(screen.getByText('wuḍūʾ · isnād')).toBeInTheDocument()
    expect(screen.getByText('Shilan Rashid')).toBeInTheDocument()
    expect(screen.getByText('Soran University')).toBeInTheDocument()
    expect(screen.getByText(/shows only what the owner chose to publish/)).toBeInTheDocument()
  })

  it('invites someone who is not signed in to sign in before asking', async () => {
    mockPublic()
    renderApp('/announcements/kufan-chains')
    const section = await screen.findByRole('region', { name: 'Interested in collaborating?' })
    expect(within(section).getByRole('link', { name: 'Sign in to ask' })).toHaveAttribute('href', '/sign-in')
    expect(within(section).queryByRole('link', { name: 'Ask to collaborate' })).not.toBeInTheDocument()
  })

  it('leads a signed-in researcher to the request form', async () => {
    mockMe()
    mockPublic()
    renderApp('/announcements/kufan-chains', { signedIn: true })
    const section = await screen.findByRole('region', { name: 'Interested in collaborating?' })
    expect(await within(section).findByRole('link', { name: 'Ask to collaborate' })).toHaveAttribute('href', '/announcements/kufan-chains/interest')
  })

  it('looks the same for an address that was never published and one that was taken down', async () => {
    mockPublic()
    renderApp('/announcements/nothing-here')
    expect(await screen.findByRole('heading', { name: 'This announcement is no longer available' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse research announcements' })).toHaveAttribute('href', '/announcements')
  })

  it('has no way to reach the project it came from', async () => {
    mockPublic()
    renderApp('/announcements/kufan-chains')
    await screen.findByRole('heading', { level: 1, name: 'Kufan chains of the wuḍūʾ reports' })
    expect(document.querySelector('a[href*="/projects/"]')).toBeNull()
  })
})
