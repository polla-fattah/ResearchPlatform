import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { envelope, mockMe, project, renderApp } from '@/test/helpers'
import { mockProjectList } from '@/test/projectMocks'
import { server } from '@/test/server'

/** The page keeps one closed <dialog> per action; the open one is the one with the open attribute. */
const openDialog = async () => {
  await screen.findAllByRole("dialog", { hidden: true })
  await waitFor(() => expect(screen.getAllByRole("dialog", { hidden: true }).some((d) => d.hasAttribute("open"))).toBe(true))
  return screen.getAllByRole("dialog", { hidden: true }).find((d) => d.hasAttribute("open"))!
}

const open = async (path = '/projects') => {
  mockMe()
  const utils = renderApp(path, { signedIn: true })
  await screen.findByRole('heading', { name: 'Projects' })
  await waitFor(() => expect(screen.queryAllByRole('status', { name: 'Loading' })).toHaveLength(0))
  return utils
}

const ibn = project({
  id: 15,
  title: 'Ibn Lahīʿa: assessments before and after 170 AH',
  question: 'How do critics distinguish his early and late transmission?',
  stage: 'collecting',
  evidence_count: 14,
  finding_count: 1,
  resource_count: 6,
  tags: ['narrators'],
  next_action: null,
})

describe('Project index (04): owned tab', () => {
  it('shows each project as drawn: stage, code, counts, next action and its three buttons', async () => {
    mockProjectList({ owned: [project(), ibn] }, { owned: 4, shared: 2, archived: 2, trash: 1 })
    await open()

    expect(screen.getByText('4 active · 2 archived · 1 in trash · all owned by you')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Owned · active · 4' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Shared with me · 2' })).toHaveAttribute('href', '/projects?scope=shared')

    const row = screen.getByRole('link', { name: /chains of the wuḍūʾ reports/i }).closest('li')!
    expect(within(row).getByText('Analysing')).toBeInTheDocument()
    expect(within(row).getByText('PRJ-0012')).toBeInTheDocument()
    expect(within(row).getByText('Owner: you')).toBeInTheDocument()
    expect(within(row).getByText(/12 resources · 38 evidence items · 6 findings/)).toBeInTheDocument()
    expect(within(row).getByRole('link', { name: 'Review 7 candidate evidence items' })).toHaveAttribute(
      'href',
      '/projects/12/evidence?state=candidate',
    )
    expect(within(row).getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/projects/12/overview')
    expect(within(row).getByRole('button', { name: 'Archive' })).toBeEnabled()
    expect(within(row).getByRole('button', { name: 'Move to trash' })).toBeEnabled()

    const other = screen.getByRole('link', { name: /ibn lahīʿa/i }).closest('li')!
    expect(within(other).getByText('#narrators')).toBeInTheDocument()
    expect(within(other).getByText('No action needed')).toBeInTheDocument()
  })

  it('offers New project and starts on the owned tab by default', async () => {
    mockProjectList({ owned: [project()] })
    await open()
    expect(screen.getByRole('link', { name: 'New project' })).toHaveAttribute('href', '/projects/new')
  })
})

describe('Project index (04): other tabs', () => {
  it('shared: shows the owner and your role, and Leave project instead of Archive', async () => {
    mockProjectList({
      shared: [
        project({
          id: 31,
          title: 'Mursal reports of al-Ḥasan al-Baṣrī',
          my_role: 'researcher',
          owner: { id: 9, display_name: 'Dr. Hēmin Raʾūf' },
        }),
      ],
    })
    await open('/projects?scope=shared')
    const row = screen.getByRole('link', { name: /mursal reports/i }).closest('li')!
    expect(within(row).getByText('Owner: Dr. Hēmin Raʾūf · You: Researcher')).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Leave project' })).toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: 'Archive' })).toBeNull()
    expect(within(row).getByText('Project')).toBeInTheDocument()
  })

  it('archived: says archiving is not completion, and offers View (read-only) and Unarchive', async () => {
    mockProjectList({ archived: [project({ id: 4, title: 'Fasting on ʿĀshūrāʾ', stage: 'collecting', is_archived: true })] })
    await open('/projects?scope=archived')
    const row = screen.getByText('Fasting on ʿĀshūrāʾ').closest('li')!
    expect(within(row).getByText(/archiving doesn't mark a project completed/i)).toHaveTextContent(/stage is kept as collecting/i)
    expect(within(row).getByRole('link', { name: 'View (read-only)' })).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Unarchive' })).toBeInTheDocument()
  })

  it('trash: shows the deletion date and days left, Restore, and no way to open it', async () => {
    const deadline = new Date(Date.now() + 25 * 86_400_000).toISOString()
    mockProjectList({ trash: [project({ id: 16, title: 'Duplicate of wuḍūʾ project', recovery_deadline: deadline, is_deleted: true })] })
    await open('/projects?scope=trash')
    expect(screen.getByText(/projects in trash are read-only and can be restored for 30 days/i)).toBeInTheDocument()
    const row = screen.getByText('Duplicate of wuḍūʾ project').closest('li')!
    expect(within(row).getByText(/deleted permanently on/i)).toBeInTheDocument()
    expect(within(row).getByText('25 days left')).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Restore' })).toBeInTheDocument()
    expect(within(row).queryByRole('link', { name: /duplicate of/i })).toBeNull() // trashed projects can't be opened
  })
})

describe('Project index (04): filters', () => {
  it('sends the typed search and the chosen stage to the API, and keeps them in the URL', async () => {
    const seen = mockProjectList({ owned: [project(), ibn] })
    const { router } = await open()
    const user = userEvent.setup()

    await user.type(screen.getByRole('searchbox', { name: 'Search projects' }), 'lahī')
    await waitFor(() => expect(seen.some((p) => p.get('q') === 'lahī')).toBe(true), { timeout: 2000 })
    expect(router.state.location.search).toContain('q=lah')
    await waitFor(() => expect(screen.queryByText(/chains of the wuḍūʾ/i)).toBeNull())

    await user.selectOptions(screen.getByRole('combobox', { name: 'Stage' }), 'collecting')
    await waitFor(() => expect(seen.some((p) => p.get('stage') === 'collecting')).toBe(true))
  })

  it('sorts the loaded page by title', async () => {
    mockProjectList({ owned: [project({ id: 1, title: 'Zeta study' }), project({ id: 2, title: 'Alpha study' })] })
    await open()
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Zeta study', 'Alpha study'])
    await userEvent.setup().selectOptions(screen.getByRole('combobox', { name: 'Sort' }), 'title')
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Alpha study', 'Zeta study'])
  })

  it('offers the tags found on the loaded projects', async () => {
    mockProjectList({ owned: [project({ tags: ['wuḍūʾ'] }), ibn] })
    await open()
    const tagSelect = screen.getByRole('combobox', { name: 'Tag' })
    expect(within(tagSelect).getByRole('option', { name: 'narrators' })).toBeInTheDocument()
    expect(within(tagSelect).getByRole('option', { name: 'wuḍūʾ' })).toBeInTheDocument()
  })
})

describe('Project index (04): actions', () => {
  it('archives a project and refreshes the list', async () => {
    let archived = false
    mockProjectList({ owned: [project()] })
    server.use(
      http.post('*/api/v1/projects/12/archive', () => {
        archived = true
        return HttpResponse.json(envelope({ id: 12 }))
      }),
    )
    await open()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Archive' }))
    await waitFor(() => expect(archived).toBe(true))
  })

  it('asks before moving to trash, says what goes with it, and only then deletes', async () => {
    let deleted = false
    mockProjectList({ owned: [ibn] })
    server.use(
      http.delete('*/api/v1/projects/15', () => {
        deleted = true
        return HttpResponse.json(envelope(null))
      }),
    )
    await open()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Move to trash' }))

    const dialog = await openDialog()
    expect(within(dialog).getByText(/move “ibn lahīʿa.*” to trash\?/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/14 evidence items and 1 finding go with it/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/you can restore it until/i)).toBeInTheDocument()
    expect(deleted).toBe(false)

    await user.click(within(dialog).getByRole('button', { name: 'Move to trash', hidden: true }))
    await waitFor(() => expect(deleted).toBe(true))
  })

  it('does nothing when the trash dialog is cancelled', async () => {
    let deleted = false
    mockProjectList({ owned: [ibn] })
    server.use(http.delete('*/api/v1/projects/15', () => ((deleted = true), HttpResponse.json(envelope(null)))))
    await open()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Move to trash' }))
    const dialog = await openDialog()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel', hidden: true }))
    expect(deleted).toBe(false)
  })

  it('restores a trashed project', async () => {
    let restored = false
    mockProjectList({ trash: [project({ id: 16, title: 'Old', is_deleted: true, recovery_deadline: new Date(Date.now() + 86_400_000).toISOString() })] })
    server.use(http.post('*/api/v1/projects/16/restore', () => ((restored = true), HttpResponse.json(envelope({ id: 16 })))))
    await open('/projects?scope=trash')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Restore' }))
    await waitFor(() => expect(restored).toBe(true))
  })

  it('confirms before leaving a shared project', async () => {
    let left = false
    mockProjectList({ shared: [project({ id: 31, title: 'Shared one', my_role: 'viewer', owner: { id: 9, display_name: 'Someone' } })] })
    server.use(http.post('*/api/v1/projects/31/leave', () => ((left = true), HttpResponse.json(envelope(null)))))
    await open('/projects?scope=shared')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Leave project' }))
    const dialog = await openDialog()
    expect(within(dialog).getByText(/anything you saved to my library stays yours/i)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Leave project', hidden: true }))
    await waitFor(() => expect(left).toBe(true))
  })

  it('shows the server message when an action fails', async () => {
    mockProjectList({ owned: [project()] })
    server.use(
      http.post('*/api/v1/projects/12/archive', () =>
        HttpResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Only the owner can archive.', details: [] } }, { status: 403 }),
      ),
    )
    await open()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Archive' }))
    expect(await screen.findByText('Only the owner can archive.')).toBeInTheDocument()
  })
})

describe('Project index (04): empty and error states', () => {
  it.each([
    ['owned', /no projects yet/i],
    ['shared', /nothing shared with you yet/i],
    ['archived', /no archived projects/i],
    ['trash', /trash is empty/i],
  ])('explains an empty %s tab', async (scope, title) => {
    mockProjectList({})
    await open(`/projects?scope=${scope}`)
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
  })

  it('invites a new researcher to create a first project, with what a project is', async () => {
    mockProjectList({})
    await open()
    expect(screen.getByText('A question')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create your first project' })).toHaveAttribute('href', '/projects/new')
  })

  it('says nothing matches when a filter finds nothing, instead of the first-project pitch', async () => {
    mockProjectList({ owned: [project()] })
    await open('/projects?q=zzz')
    expect(await screen.findByRole('heading', { name: 'No projects match' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Create your first project' })).toBeNull()
  })

  it('shows a retry when the list cannot be loaded', async () => {
    mockMe()
    server.use(http.get('*/api/v1/projects', () => HttpResponse.error()))
    renderApp('/projects', { signedIn: true })
    expect(await screen.findByRole('heading', { name: /projects didn't load/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('keeps the last list and the filter when a refetch fails (design: "couldn\'t be filtered")', async () => {
    let fail = false
    mockMe()
    server.use(
      http.get('*/api/v1/projects', ({ request }) => {
        if (fail && new URL(request.url).searchParams.get('q')) return HttpResponse.error()
        return HttpResponse.json(
          envelope([project()], {
            pagination: { current_page: 1, per_page: 20, total_items: 1, total_pages: 1, has_more: false },
            counts: { owned: 1, shared: 0, archived: 0, trash: 0 },
          }),
        )
      }),
    )
    renderApp('/projects', { signedIn: true })
    await screen.findByRole('link', { name: /chains of the wuḍūʾ/i })
    fail = true
    await userEvent.setup().type(screen.getByRole('searchbox', { name: 'Search projects' }), 'ibn')
    expect(await screen.findByRole('heading', { name: /projects couldn't be filtered/i }, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByText(/your filter “ibn” is kept/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /chains of the wuḍūʾ/i })).toBeInTheDocument() // last list still shown
    expect(screen.getByRole('searchbox', { name: 'Search projects' })).toHaveValue('ibn')
  })
})
