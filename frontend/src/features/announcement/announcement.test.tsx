import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { envelope, mockMe, renderApp } from '@/test/helpers'
import { mockProjectApis, projectDetail } from '@/test/projectMocks'
import { server } from '@/test/server'

const announcement = (over: Record<string, unknown> = {}) => ({
  id: 3,
  project_id: 12,
  public_slug: 'kufan-chains',
  title: 'Kufan chains of the wuḍūʾ reports',
  summary: 'We are collecting the Kufan routes of the "three times" wording.',
  research_stage: 'analysing',
  keywords: ['isnad', 'wuḍūʾ'],
  status: 'draft',
  published_at: null,
  updated_at: '2026-10-04T10:00:00Z',
  ...over,
})

interface Apis {
  current?: Record<string, unknown> | null
  detail?: Record<string, unknown>
  history?: Record<string, unknown>[]
  save?: (body: Record<string, unknown>) => Response | undefined
  publish?: () => Response | undefined
}

function mockAnnouncement(o: Apis = {}) {
  let current: Record<string, unknown> | null = o.current === undefined ? announcement() : o.current
  const calls = { saved: [] as Record<string, unknown>[], published: 0, unpublished: 0 }
  mockProjectApis(12, { detail: o.detail ?? projectDetail() })
  server.use(
    http.get('*/api/v1/projects/12/announcement', () => HttpResponse.json(envelope(current))),
    http.post('*/api/v1/projects/12/announcement', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.saved.push(body)
      const custom = o.save?.(body)
      if (custom) return custom
      current = announcement({ ...(current ?? {}), ...body, id: 3, updated_at: `2026-10-05T10:0${calls.saved.length}:00Z` })
      return HttpResponse.json(envelope(current))
    }),
    http.post('*/api/v1/projects/12/announcement/publish', () => {
      calls.published++
      const custom = o.publish?.()
      if (custom) return custom
      current = { ...current!, status: 'published', published_at: '2026-10-05T11:00:00Z', updated_at: '2026-10-05T11:00:00Z' }
      return HttpResponse.json(envelope(current))
    }),
    http.post('*/api/v1/projects/12/announcement/unpublish', () => {
      calls.unpublished++
      current = { ...current!, status: 'unpublished', updated_at: '2026-10-05T12:00:00Z' }
      return HttpResponse.json(envelope(current))
    }),
    http.get('*/api/v1/projects/12/announcement/history', () =>
      HttpResponse.json(envelope({ announcement: current, history: o.history ?? [] })),
    ),
  )
  return calls
}

const asResearcher = { detail: projectDetail({ owner_id: 2, owner: { id: 2, display_name: 'Aras Kamal' }, memberships: [{ user_id: 1, role: 'researcher', status: 'accepted' }] }) }

describe('Announcement (owner)', () => {
  it('says there is none yet and starts a draft from the project’s own title and stage', async () => {
    mockMe()
    mockAnnouncement({ current: null })
    renderApp('/projects/12/announcement', { signedIn: true })
    expect(await screen.findByText('No announcement yet')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Start a draft' }))
    const form = await screen.findByRole('form', { name: 'Announcement' })
    expect(within(form).getByLabelText(/Public title/)).toHaveValue('Chains of the wuḍūʾ reports in the Sunan collections')
    expect(within(form).getByLabelText(/Address of the public page/)).toHaveValue('chains-of-the-wuḍūʾ-reports-in-the-sunan-collections')
    expect(within(form).getByLabelText(/Stage shown/)).toHaveValue('analysing')
  })

  it('saves a first draft as a draft, with keywords as a list, and then shows it as saved', async () => {
    mockMe()
    const calls = mockAnnouncement({ current: null })
    renderApp('/projects/12/announcement', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Start a draft' }))
    const form = await screen.findByRole('form', { name: 'Announcement' })
    await userEvent.type(within(form).getByLabelText(/Question and summary/), 'We study the Kufan routes.')
    await userEvent.type(within(form).getByLabelText(/Keywords/), 'isnad, wuḍūʾ ,isnad')
    expect(within(form).getByText(/Cannot publish yet/)).toBeInTheDocument()
    await userEvent.click(within(form).getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(calls.saved).toHaveLength(1))
    expect(calls.saved[0]).toEqual({
      public_slug: 'chains-of-the-wuḍūʾ-reports-in-the-sunan-collections',
      title: 'Chains of the wuḍūʾ reports in the Sunan collections',
      summary: 'We study the Kufan routes.',
      research_stage: 'analysing',
      keywords: ['isnad', 'wuḍūʾ'],
      status: 'draft',
    })
    expect(await screen.findByText('Draft · not public')).toBeInTheDocument()
  })

  it('does not save without a summary or with an address that is not an address', async () => {
    mockMe()
    const calls = mockAnnouncement({ current: null })
    renderApp('/projects/12/announcement', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Start a draft' }))
    const form = await screen.findByRole('form', { name: 'Announcement' })
    const slug = within(form).getByLabelText(/Address of the public page/)
    await userEvent.clear(slug)
    await userEvent.type(slug, 'not valid')
    await userEvent.click(within(form).getByRole('button', { name: 'Save draft' }))
    expect(await within(form).findByText('Write a summary for the public page')).toBeInTheDocument()
    expect(within(form).getByText('Use letters, numbers and single hyphens, with no spaces')).toBeInTheDocument()
    expect(calls.saved).toEqual([])
  })

  it('shows the public preview from what is typed, with the project’s own title, scope and owner', async () => {
    mockMe()
    mockAnnouncement()
    renderApp('/projects/12/announcement', { signedIn: true })
    const preview = await screen.findByRole('region', { name: 'Public preview' })
    expect(within(preview).getByText('Project announcement · ongoing research · not peer-reviewed')).toBeInTheDocument()
    expect(within(preview).getByText('Kufan chains of the wuḍūʾ reports')).toBeInTheDocument()
    expect(within(preview).getByText('All 14 occurrences in the six Sunan collections.')).toBeInTheDocument()
    expect(within(preview).getByText('Shilan Rashid')).toBeInTheDocument()
    const title = screen.getByLabelText(/Public title/)
    await userEvent.clear(title)
    await userEvent.type(title, 'A new title')
    expect(within(preview).getByText('A new title')).toBeInTheDocument()
    expect(screen.getByText(/Never public:/)).toBeInTheDocument()
  })

  it('publishes a saved draft only after saying what becomes public, then shows it live with a link', async () => {
    mockMe()
    const calls = mockAnnouncement()
    renderApp('/projects/12/announcement', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Publish…' }))
    const dialog = await screen.findByRole('dialog', { name: /Publish “Kufan chains/ })
    expect(within(dialog).getByText(/The project's scope/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Your name/)).toBeInTheDocument()
    expect(calls.published).toBe(0)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Publish' }))
    await waitFor(() => expect(calls.published).toBe(1))
    expect(await screen.findByText('Published · public')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open the public page' })).toHaveAttribute('href', '/announcements/kufan-chains')
  })

  it('will not publish while there are unsaved changes, and says to save first', async () => {
    mockMe()
    mockAnnouncement()
    renderApp('/projects/12/announcement', { signedIn: true })
    const form = await screen.findByRole('form', { name: 'Announcement' })
    expect(within(form).getByRole('button', { name: 'Publish…' })).toBeEnabled()
    await userEvent.type(within(form).getByLabelText(/Public title/), '!')
    expect(within(form).getByRole('button', { name: 'Publish…' })).toBeDisabled()
    expect(within(form).getByText('Save your changes first: what is published is what is saved.')).toBeInTheDocument()
  })

  it('keeps a published page published when it is saved (the server would otherwise make it a draft), and warns that saving is live', async () => {
    mockMe()
    const calls = mockAnnouncement({ current: announcement({ status: 'published', published_at: '2026-10-04T10:00:00Z' }) })
    renderApp('/projects/12/announcement', { signedIn: true })
    const form = await screen.findByRole('form', { name: 'Announcement' })
    expect(within(form).getByText(/saving changes the public page at once/)).toBeInTheDocument()
    expect(within(form).getByLabelText(/Address of the public page/)).toBeDisabled()
    await userEvent.type(within(form).getByLabelText(/Public title/), ' (revised)')
    await userEvent.click(within(form).getByRole('button', { name: 'Save changes to the public page' }))
    await waitFor(() => expect(calls.saved[0]).toMatchObject({ status: 'published', title: 'Kufan chains of the wuḍūʾ reports (revised)' }))
  })

  it('unpublishes after confirming, and the page is then not public', async () => {
    mockMe()
    const calls = mockAnnouncement({ current: announcement({ status: 'published', published_at: '2026-10-04T10:00:00Z' }) })
    renderApp('/projects/12/announcement', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Unpublish…' }))
    const dialog = await screen.findByRole('dialog', { name: /Unpublish “Kufan chains/ })
    expect(calls.unpublished).toBe(0)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Unpublish' }))
    await waitFor(() => expect(calls.unpublished).toBe(1))
    expect(await screen.findByText('Unpublished · not public')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open the public page' })).not.toBeInTheDocument()
  })

  it('reports a field the server accepted but did not keep', async () => {
    mockMe()
    mockAnnouncement({ save: () => HttpResponse.json(envelope(announcement({ title: 'Something else' }))) })
    renderApp('/projects/12/announcement', { signedIn: true })
    const form = await screen.findByRole('form', { name: 'Announcement' })
    await userEvent.type(within(form).getByLabelText(/Public title/), '!')
    await userEvent.click(within(form).getByRole('button', { name: 'Save draft' }))
    expect(await within(form).findByText(/did not keep/)).toBeInTheDocument()
    expect(within(form).getByLabelText(/Public title/)).toHaveValue('Kufan chains of the wuḍūʾ reports!')
  })

  it('shows the server’s reason when publishing fails, and the page stays a draft', async () => {
    mockMe()
    mockAnnouncement({ publish: () => HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'That address is already used.' } }, { status: 422 }) })
    renderApp('/projects/12/announcement', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Publish…' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Publish' }))
    expect(await screen.findByText(/That address is already used/)).toBeInTheDocument()
    expect(screen.getByText('Draft · not public')).toBeInTheDocument()
  })

  it('lists what the server remembers, and says what it does not', async () => {
    mockMe()
    mockAnnouncement({ history: [{ id: 5, action: 'announcement_unpublished', summary: "Unpublished research announcement 'Kufan'", created_at: '2026-10-03T09:00:00Z', actor: { id: 1, display_name: 'Shilan Rashid' } }] })
    renderApp('/projects/12/announcement', { signedIn: true })
    expect(await screen.findByText("Unpublished research announcement 'Kufan'")).toBeInTheDocument()
    expect(screen.getByText(/Only taking the announcement down is recorded today/)).toBeInTheDocument()
  })

  it('cannot be edited or restored when a moderator hid it', async () => {
    mockMe()
    mockAnnouncement({ current: announcement({ status: 'hidden' }) })
    renderApp('/projects/12/announcement', { signedIn: true })
    expect(await screen.findByText(/hidden by a moderator, so it is not public/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Public title/)).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publish…' })).not.toBeInTheDocument()
  })
})

describe('Announcement (not the owner)', () => {
  it('reads the current announcement with no way to change it', async () => {
    mockMe()
    mockAnnouncement(asResearcher)
    renderApp('/projects/12/announcement', { signedIn: true })
    expect(await screen.findByText(/Only the project owner can draft, publish or take down the announcement/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Public title/)).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publish…' })).not.toBeInTheDocument()
  })

  it('says only the owner can start one when there is none', async () => {
    mockMe()
    mockAnnouncement({ ...asResearcher, current: null })
    renderApp('/projects/12/announcement', { signedIn: true })
    expect(await screen.findByText('No announcement yet')).toBeInTheDocument()
    expect(screen.getByText('The owner has not written one.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start a draft' })).not.toBeInTheDocument()
  })
})
