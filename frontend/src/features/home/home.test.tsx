import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFERENCES, formatRelative } from '@/i18n/format'
import { envelope, mockHomeApis, mockMe, project, renderApp } from '@/test/helpers'
import { server } from '@/test/server'

const open = async () => {
  mockMe()
  const utils = renderApp('/home', { signedIn: true })
  await screen.findByRole('heading', { name: /welcome/i })
  // The header renders at once; wait until every section has finished loading.
  await waitFor(() => expect(screen.queryAllByRole('status', { name: 'Loading' })).toHaveLength(0))
  return utils
}

describe('Home (02): normal', () => {
  it('greets the researcher and shows recent projects as drawn in the mockup', async () => {
    mockHomeApis({
      projects: [
        project(),
        project({
          id: 15,
          title: 'Ibn Lahīʿa: assessments before and after 170 AH',
          question: 'How do critics distinguish his early and late transmission?',
          stage: 'collecting',
          evidence_count: 14,
          finding_count: 1,
          next_action: null,
        }),
      ],
      counts: { owned: 4, shared: 2, archived: 0, trash: 0 },
    })
    await open()

    expect(screen.getByRole('heading', { name: 'Welcome back, Shilan Rashid' })).toBeInTheDocument()
    const first = screen.getByRole('link', { name: /chains of the wuḍūʾ reports/i }).closest('li')!
    expect(within(first).getByText('Analysing')).toBeInTheDocument()
    expect(within(first).getByText('Private')).toBeInTheDocument()
    expect(within(first).getByText(/38 evidence items · 6 findings/)).toBeInTheDocument()
    expect(within(first).getByText(/updated 2 hours ago/i)).toBeInTheDocument()
    expect(within(first).getByText('PRJ-0012')).toBeInTheDocument()
    expect(within(first).getByRole('link')).toHaveAttribute('href', '/projects/12/overview')

    const second = screen.getByRole('link', { name: /ibn lahīʿa/i }).closest('li')!
    expect(within(second).getByText(/14 evidence items · 1 finding(?!s)/)).toBeInTheDocument()
    expect(screen.getByText('Owned · 4 · Shared · 2')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'All projects' })).toHaveAttribute('href', '/projects')
  })

  it('offers Save a source and New project', async () => {
    mockHomeApis()
    await open()
    expect(screen.getByRole('link', { name: 'New project' })).toHaveAttribute('href', '/projects/new')
    expect(screen.getByRole('link', { name: 'Save a source' })).toHaveAttribute('href', '/library/add')
  })

  it('marks a project you were invited to as shared, not private', async () => {
    mockHomeApis({ projects: [project({ my_role: 'researcher' })] })
    await open()
    expect(screen.getByText('Project')).toBeInTheDocument()
    expect(screen.queryByText('Private')).toBeNull()
  })

  it('never shows the backend placeholder as if it were the research question', async () => {
    mockHomeApis({ projects: [project({ question: 'Not written yet', next_action: null })] })
    await open()
    expect(screen.getByText('Question not written yet')).toBeInTheDocument()
    expect(screen.queryByText('Not written yet')).toBeNull()
  })
})

describe('Home (02): next actions', () => {
  it('lists each project next action with its project and a link to the target', async () => {
    mockHomeApis()
    await open()
    const item = screen.getByText('Review 7 candidate evidence items').closest('li')!
    expect(within(item).getByText(/chains of the wuḍūʾ reports.*PRJ-0012/i)).toBeInTheDocument()
    expect(within(item).getByRole('link', { name: /open/i })).toHaveAttribute(
      'href',
      '/projects/12/evidence?state=candidate',
    )
  })

  it('says so when nothing needs attention', async () => {
    mockHomeApis({ projects: [project({ next_action: null })] })
    await open()
    expect(screen.getByText(/nothing needs your attention/i)).toBeInTheDocument()
  })
})

describe('Home (02): downloads', () => {
  const job = (over: Record<string, unknown> = {}) => ({
    id: 61,
    scope: 'project',
    target_id: 12,
    format: 'zip',
    status: 'running',
    progress: '236 of 381 objects packaged',
    created_at: new Date(Date.now() - 3600 * 1000).toISOString(),
    ...over,
  })

  it('shows running progress, and partial jobs as neutral rather than failed', async () => {
    mockHomeApis({
      exports: [
        job(),
        job({ id: 60, scope: 'account', status: 'partial', progress: null }),
        job({ id: 58, scope: 'document', format: 'pdf', status: 'complete', expires_at: new Date(Date.now() + 5 * 86400 * 1000).toISOString() }),
      ],
    })
    await open()
    expect(screen.getByText('236 of 381 objects packaged')).toBeInTheDocument()
    const partial = screen.getByText('Partial')
    expect(partial.className).toMatch(/chipNeutral/)
    expect(screen.getByText('Running').className).toMatch(/chipActive/)
    expect(screen.getByText(/expires in 5 days/i)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'View job' })[0]).toHaveAttribute('href', '/downloads')
  })

  it('does not present stub progress for a queued job as real (request file C-7)', async () => {
    mockHomeApis({ exports: [job({ status: 'queued', progress: '0 of 100 objects packaged' })] })
    await open()
    expect(screen.getByText('Queued')).toBeInTheDocument()
    expect(screen.queryByText(/0 of 100 objects/)).toBeNull()
  })

  it('shows a plain empty line when there are no exports', async () => {
    mockHomeApis({ exports: [] })
    await open()
    expect(screen.getByText(/no exports yet/i)).toBeInTheDocument()
  })
})

describe('Home (02): counts line', () => {
  it('shows open tasks and unread notifications with units', async () => {
    mockHomeApis({ openTasks: 2, unread: 3 })
    await open()
    expect(await screen.findByText('2 tasks assigned to you · 3 unread notifications')).toBeInTheDocument()
  })

  it('leaves out a part that fails to load', async () => {
    mockHomeApis({ openTasks: 1, unread: HttpResponse.json({ message: 'x' }, { status: 500 }) as unknown as number })
    await open()
    expect(await screen.findByText('1 task assigned to you')).toBeInTheDocument()
  })
})

describe('Home (02): empty, loading, error, forbidden', () => {
  it('welcomes a new account with the two ways to start', async () => {
    mockHomeApis({ projects: [] })
    await open()
    expect(screen.getByRole('heading', { name: 'Welcome, Shilan Rashid' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Start your first investigation' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'New project' })).toHaveAttribute('href', '/projects/new')
    expect(screen.getByRole('link', { name: 'Save a source' })).toHaveAttribute('href', '/library/add')
    expect(screen.queryByText('Recent projects')).toBeNull()
  })

  it('shows skeletons while projects load, without shifting the page structure', async () => {
    mockMe()
    server.use(
      http.get('*/api/v1/projects', async () => {
        await new Promise((r) => setTimeout(r, 150))
        return HttpResponse.json(envelope([project()], { counts: { owned: 1, shared: 0, archived: 0, trash: 0 } }))
      }),
      http.get('*/api/v1/me/exports', () => HttpResponse.json(envelope([]))),
      http.get('*/api/v1/me/tasks', () => HttpResponse.json(envelope([]))),
      http.get('*/api/v1/notifications/unread-count', () => HttpResponse.json(envelope({ unread_count: 0 }))),
    )
    renderApp('/home', { signedIn: true })
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Recent projects' })).toBeInTheDocument()
    expect(screen.getAllByRole('status', { name: 'Loading' }).length).toBeGreaterThan(0)
    expect(await screen.findByRole('link', { name: /chains of the wuḍūʾ/i })).toBeInTheDocument()
  })

  it('shows an error for projects only, with a retry, while downloads still load', async () => {
    mockHomeApis({
      projects: HttpResponse.json({ message: 'boom' }, { status: 500 }) as unknown as unknown[],
      exports: [
        { id: 58, scope: 'document', format: 'pdf', status: 'complete', created_at: new Date().toISOString(), expires_at: null },
      ],
    })
    await open()
    const alert = await screen.findByText(/your projects didn't load/i)
    expect(alert).toBeInTheDocument()
    expect(screen.getByText(/your research is safe/i)).toBeInTheDocument()
    expect(screen.getByText('Complete')).toBeInTheDocument() // downloads loaded normally
    expect(screen.getByText(/next actions couldn't be worked out/i)).toBeInTheDocument()

    // Retry succeeds.
    mockHomeApis()
    await userEvent.setup().click(screen.getAllByRole('button', { name: /try again/i })[0]!)
    expect(await screen.findByRole('link', { name: /chains of the wuḍūʾ/i })).toBeInTheDocument()
  })

  it('shows the same "not available" page for 403 and 404', async () => {
    for (const status of [403, 404]) {
      mockHomeApis({ projects: HttpResponse.json({ message: 'no' }, { status }) as unknown as unknown[] })
      const { unmount } = await open()
      expect(await screen.findByRole('heading', { name: /that page isn't available/i })).toBeInTheDocument()
      unmount()
    }
  })

  it('stays on Home when Hijri conversion is unavailable (no crash)', async () => {
    mockHomeApis()
    await open()
    await waitFor(() => expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument())
  })
})

describe('relative times', () => {
  const now = new Date('2026-10-05T12:00:00Z')
  const rel = (iso: string) => formatRelative(iso, 'en', DEFAULT_PREFERENCES, now)

  it('speaks in minutes, hours and days, then falls back to a date', () => {
    expect(rel('2026-10-05T11:30:00Z')).toBe('30 minutes ago')
    expect(rel('2026-10-05T10:00:00Z')).toBe('2 hours ago')
    expect(rel('2026-10-04T12:00:00Z')).toBe('yesterday')
    expect(rel('2026-10-02T12:00:00Z')).toBe('3 days ago')
    expect(rel('2026-09-20T12:00:00Z')).toContain('2026')
    expect(rel('2026-10-06T12:00:00Z')).toBe('tomorrow')
    expect(rel('nonsense')).toBe('')
  })
})
