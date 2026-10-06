import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { envelope, mockMe, project, renderApp } from '@/test/helpers'
import { mockProjectApis, mockProjectList, projectDetail, summary } from '@/test/projectMocks'
import { server } from '@/test/server'

const viewerDetail = projectDetail({
  owner_id: 99,
  owner: { id: 99, display_name: 'Dr. Hēmin Raʾūf' },
  memberships: [
    { user_id: 99, role: 'owner', status: 'accepted', user: { id: 99, display_name: 'Dr. Hēmin Raʾūf' } },
    { user_id: 1, role: 'viewer', status: 'accepted', user: { id: 1, display_name: 'Shilan Rashid' } },
  ],
})

async function open(path = '/projects/12/overview') {
  mockMe()
  const utils = renderApp(path, { signedIn: true })
  await screen.findByText('PRJ-0012')
  await screen.findByRole('heading', { level: 1 }) // the project has loaded
  await waitFor(() => {
    expect(screen.queryAllByRole('status', { name: 'Loading' })).toHaveLength(0)
    expect(screen.queryByText('Loading…')).toBeNull()
  })
  return utils
}

describe('Project shell and overview (06)', () => {
  it('shows the project header: code, title, stage and Private for an owner', async () => {
    mockProjectApis()
    await open()
    expect(await screen.findByRole('heading', { level: 1, name: /chains of the wuḍūʾ reports/i })).toBeInTheDocument()
    expect(screen.getAllByText('Analysing').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Private').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Projects' }).every((a) => a.getAttribute('href') === '/projects')).toBe(true)
  })

  it('shows the same "Project not available" page for a missing and a forbidden project', async () => {
    for (const status of [403, 404]) {
      mockProjectApis(12, { detail: HttpResponse.json({ message: 'no' }, { status }) })
      mockMe()
      const { unmount } = renderApp('/projects/12/overview', { signedIn: true })
      expect(await screen.findByRole('heading', { name: 'Project not available' })).toBeInTheDocument()
      expect(screen.getByText(/we show the same message in both cases/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Go to your projects' })).toHaveAttribute('href', '/projects')
      unmount()
    }
  })

  it('shows question, scope, languages, owner and created date', async () => {
    mockProjectApis()
    await open()
    expect(screen.getByText(/do the kufan chains/i)).toBeInTheDocument()
    expect(screen.getByText(/all 14 occurrences in the six sunan/i)).toBeInTheDocument()
    expect(screen.getByText('Content: Arabic · العربية, Sorani · کوردی')).toBeInTheDocument()
    expect(screen.getByText('Owner: Shilan Rashid')).toBeInTheDocument()
    expect(screen.getByText(/created .*2026/i)).toBeInTheDocument()
  })

  it('shows an unwritten question as unknown, not as text', async () => {
    mockProjectApis(12, { detail: projectDetail({ question: null, scope: null }) })
    await open()
    expect(screen.getAllByText('Not written yet').length).toBe(2)
  })

  it('shows evidence counts by state with the denominator and the "reviewed" caveat', async () => {
    mockProjectApis()
    await open()
    expect(screen.getByText('38 evidence items in this project')).toBeInTheDocument()
    const legend = screen.getByText('Candidate').closest('li')!
    expect(within(legend).getByText('7')).toBeInTheDocument()
    expect(within(legend).getByText('of 38 evidence items')).toBeInTheDocument()
    expect(screen.getByText(/reviewed.*doesn't mean the report is authentic or correct/i)).toBeInTheDocument()
  })

  it('shows counts as Unknown, never zero, when they cannot be calculated, and recalculates on request', async () => {
    mockProjectApis(12, { summary: HttpResponse.json({ message: 'boom' }, { status: 500 }) })
    await open()
    expect(await screen.findByText('Total: Unknown')).toBeInTheDocument()
    expect(screen.getByText(/shown as unknown, not zero/i)).toBeInTheDocument()
    const candidate = screen.getByText('Candidate').closest('li')!
    expect(within(candidate).getByText('Unknown')).toBeInTheDocument()
    expect(within(candidate).queryByText('0')).toBeNull()

    mockProjectApis()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Recalculate' }))
    expect(await screen.findByText('38 evidence items in this project')).toBeInTheDocument()
  })

  it('shows the empty-project guidance when nothing has been added yet', async () => {
    mockProjectApis(12, {
      summary: summary({
        evidence_counts: { candidate: 0, included: 0, reviewed: 0, excluded: 0, unresolved: 0, total: 0 },
        resources_count: 0,
        saved_searches_count: 0,
        findings_count: 0,
      }),
    })
    await open()
    expect(await screen.findByRole('heading', { name: 'This project is empty' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /from my library or the corpus/i })).toHaveAttribute('href', '/projects/12/resources')
  })

  it('derives next actions from real counts and open questions, and links the contents', async () => {
    mockProjectApis(12, { questions: [{ id: 1, text: 'Which edition of al-Kāmil do we cite?', resolved: false, created_at: '2026-09-30T10:00:00Z', linked_evidence_ids: [] }] })
    await open()
    expect(screen.getByRole('link', { name: /review 7 candidate evidence items/i })).toHaveAttribute('href', '/projects/12/evidence?state=candidate')
    expect(screen.getByRole('link', { name: /resolve 1 unresolved item/i })).toHaveAttribute('href', '/projects/12/evidence?state=unresolved')
    expect(screen.getByRole('link', { name: /answer an open question/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /12 resources/i })).toHaveAttribute('href', '/projects/12/resources')
    expect(screen.getByRole('link', { name: /6 findings/i })).toHaveAttribute('href', '/projects/12/findings')
  })
})

describe('Overview: stage', () => {
  it('moves the stage, notes that moving back is logged, and can undo', async () => {
    const calls: unknown[] = []
    mockProjectApis()
    server.use(
      http.patch('*/api/v1/projects/12/stage', async ({ request }) => {
        calls.push(await request.json())
        return HttpResponse.json(envelope({ id: 12 }))
      }),
    )
    await open()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /collecting/i }))
    expect(await screen.findByText(/stage changed from analysing to collecting \(moved back\)/i)).toBeInTheDocument()
    expect(calls[0]).toMatchObject({ stage: 'collecting' })

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(calls).toHaveLength(2))
    expect(calls[1]).toMatchObject({ stage: 'analysing' })
  })

  it('marks the current stage and lets only the owner change it', async () => {
    mockProjectApis(12, { detail: viewerDetail })
    await open()
    expect(screen.getByRole('button', { name: /analysing/i })).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: /collecting/i })).toBeDisabled()
  })
})

describe('Overview: milestones and open questions', () => {
  it('shows manual milestones as estimates and computed ones with their basis', async () => {
    mockProjectApis(12, {
      milestones: [
        { id: 1, title: 'Narrator assessments gathered', due_date: '2026-10-20', progress_mode: 'manual', manual_percent: 40 },
        { id: 2, title: 'Every chain parsed and checked', due_date: '2026-10-10', progress_mode: 'computed', computed_basis: '10 of 14 chains checked' },
      ],
    })
    await open()
    const manual = screen.getByText('Narrator assessments gathered').closest('li')!
    expect(within(manual).getByText(/about 40%, judged by you/i)).toBeInTheDocument()
    expect(within(manual).getByText('Manual estimate')).toBeInTheDocument()
    expect(within(manual).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40')
    const computed = screen.getByText('Every chain parsed and checked').closest('li')!
    expect(within(computed).getByText('10 of 14 chains checked')).toBeInTheDocument()
    expect(within(computed).queryByText('Manual estimate')).toBeNull()
  })

  it('adds a milestone and a question', async () => {
    const posted: Record<string, unknown> = {}
    mockProjectApis()
    server.use(
      http.post('*/api/v1/projects/12/milestones', async ({ request }) => {
        posted.milestone = await request.json()
        return HttpResponse.json(envelope({ id: 9, title: 'Draft' }), { status: 201 })
      }),
      http.post('*/api/v1/projects/12/questions', async ({ request }) => {
        posted.question = await request.json()
        return HttpResponse.json(envelope({ id: 9, text: 'Q' }), { status: 201 })
      }),
    )
    await open()
    const user = userEvent.setup()

    await user.click(screen.getAllByRole('button', { name: '+ Add' })[0]!)
    await user.type(screen.getByLabelText('Milestone'), 'Draft of main article')
    await user.type(screen.getByLabelText('Progress, %'), '{Backspace}10')
    await user.click(screen.getByRole('button', { name: 'Add milestone' }))
    await waitFor(() => expect(posted.milestone).toMatchObject({ title: 'Draft of main article', manual_percent: 10, progress_mode: 'manual' }))

    await user.click(screen.getAllByRole('button', { name: '+ Add' })[1]!) // second one belongs to Open questions
    await user.type(screen.getByLabelText('Question'), 'Is Shuʿba the common link?')
    await user.click(screen.getByRole('button', { name: 'Add question' }))
    await waitFor(() => expect(posted.question).toEqual({ text: 'Is Shuʿba the common link?' }))
  })

  it('hides the add buttons and says why for a viewer', async () => {
    mockProjectApis(12, { detail: viewerDetail })
    await open()
    expect(screen.queryByRole('button', { name: '+ Add' })).toBeNull()
    expect(screen.queryByRole('link', { name: /copy to another project/i })).toBeNull()
    expect(screen.getByText(/only researchers and the owner can add to it/i)).toBeInTheDocument()
  })
})

describe('Settings view', () => {
  it('saves the details and offers archive and trash to the owner', async () => {
    let patch: unknown
    mockProjectApis()
    server.use(
      http.patch('*/api/v1/projects/12', async ({ request }) => {
        patch = await request.json()
        return HttpResponse.json(envelope(projectDetail({ title: 'Renamed' })))
      }),
    )
    await open('/projects/12/settings')
    const user = userEvent.setup()
    const title = screen.getByLabelText(/^title/i)
    await user.clear(title)
    await user.type(title, 'Renamed')
    await user.click(screen.getByRole('button', { name: 'Save details' }))
    await waitFor(() => expect(patch).toMatchObject({ title: 'Renamed' }))
    expect(await screen.findByText('Details saved.')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Archive' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Move to trash…' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Transfer' })).toBeDisabled() // R1b
    expect(screen.getByText(/38 evidence items, 6 findings and 2 documents go with it/i)).toBeInTheDocument()
  })

  it('keeps what was typed when saving fails', async () => {
    mockProjectApis()
    server.use(
      http.patch('*/api/v1/projects/12', () =>
        HttpResponse.json({ success: false, error: { code: 'ERROR', message: 'Nope.', details: [] } }, { status: 500 }),
      ),
    )
    await open('/projects/12/settings')
    const user = userEvent.setup()
    const title = screen.getByLabelText(/^title/i)
    await user.clear(title)
    await user.type(title, 'Edited title')
    await user.click(screen.getByRole('button', { name: 'Save details' }))
    expect(await screen.findByText(/the details weren't saved/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^title/i)).toHaveValue('Edited title')
  })

  it('moves to trash after confirmation and goes to the trash tab', async () => {
    let deleted = false
    mockProjectApis()
    mockProjectList({})
    server.use(http.delete('*/api/v1/projects/12', () => ((deleted = true), HttpResponse.json(envelope(null)))))
    const { router } = await open('/projects/12/settings')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Move to trash…' }))
    const dialog = (await screen.findAllByRole('dialog', { hidden: true })).find((d) => d.hasAttribute('open'))!
    await user.click(within(dialog).getByRole('button', { name: 'Move to trash', hidden: true }))
    await waitFor(() => expect(deleted).toBe(true))
    await waitFor(() => expect(router.state.location.pathname + router.state.location.search).toBe('/projects?scope=trash'))
  })

  it('is read-only for someone who is not the owner', async () => {
    mockProjectApis(12, { detail: viewerDetail })
    await open('/projects/12/settings')
    expect(screen.getByText(/only the owner can change project settings/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^title/i)).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Archive' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move to trash…' })).toBeDisabled()
  })

  it('offers Unarchive for an archived project', async () => {
    mockProjectApis(12, { detail: projectDetail({ is_archived: true }) })
    await open('/projects/12/settings')
    expect(screen.getByRole('button', { name: 'Unarchive' })).toBeInTheDocument()
  })
})

describe('Copy to another project', () => {
  const resources = [{ id: 7, title: 'Sunan Abī Dāwūd 106' }, { id: 8, title: 'Sunan al-Tirmidhī 44' }]
  const searches = [{ id: 3, name: 'wuḍūʾ thalāthan' }]

  function copyApis(copyResult: unknown[] = []) {
    mockProjectApis()
    mockProjectList({ owned: [project(), project({ id: 18, title: 'Women narrators in the Kufan chains' })] })
    const calls: { preview: unknown[]; copy: unknown[] } = { preview: [], copy: [] }
    server.use(
      http.get('*/api/v1/projects/12/resources', () => HttpResponse.json(envelope(resources))),
      http.get('*/api/v1/projects/12/searches', () => HttpResponse.json(envelope(searches))),
      http.post('*/api/v1/projects/12/copy-preview', async ({ request }) => {
        calls.preview.push(await request.json())
        return HttpResponse.json(envelope([{ type: 'resource', id: 7, can_copy: true }]))
      }),
      http.post('*/api/v1/projects/12/copy', async ({ request }) => {
        calls.copy.push(await request.json())
        return HttpResponse.json(envelope(copyResult))
      }),
    )
    return calls
  }

  it('previews visibility for the destination and says what is never copied', async () => {
    const calls = copyApis()
    await open('/projects/12/copy')
    const user = userEvent.setup()
    expect(screen.getByRole('button', { name: 'Copy 0 items' })).toBeDisabled()

    await user.selectOptions(await screen.findByLabelText('Destination'), '18')
    await user.click(await screen.findByLabelText('Sunan Abī Dāwūd 106'))
    expect(await screen.findByText(/visibility preview · PRJ-0018/i)).toBeInTheDocument()
    expect(screen.getByText(/members and roles · private annotations · publication authority · activity history/i)).toBeInTheDocument()
    await waitFor(() => expect(calls.preview[0]).toEqual({ target_project_id: 18, items: [{ type: 'resource', id: 7 }] }))
    expect(screen.getByText('Analyses can\'t be copied yet.')).toBeInTheDocument()
  })

  it('copies and reports honestly which items were and were not copied', async () => {
    const calls = copyApis([
      { type: 'resource', id: 7, status: 'copied' },
      { type: 'saved_query', id: 3, status: 'copied' },
    ])
    await open('/projects/12/copy')
    const user = userEvent.setup()
    await user.selectOptions(await screen.findByLabelText('Destination'), '18')
    await user.click(await screen.findByLabelText('Sunan Abī Dāwūd 106'))
    await user.click(screen.getByLabelText('Sunan al-Tirmidhī 44'))
    await user.click(screen.getByLabelText('wuḍūʾ thalāthan'))
    await user.click(screen.getByRole('button', { name: 'Copy 3 items' }))

    expect(await screen.findByRole('heading', { name: 'Copied 2 of 3 items' })).toBeInTheDocument()
    expect(screen.getByText(/sunan abī dāwūd 106 was copied/i)).toBeInTheDocument()
    expect(screen.getByText(/sunan al-tirmidhī 44 wasn't copied/i)).toBeInTheDocument()
    expect(calls.copy[0]).toMatchObject({ target_project_id: 18 })
  })

  it('tells you to create a project first when there is nowhere to copy to', async () => {
    mockProjectApis()
    mockProjectList({ owned: [project()] })
    server.use(
      http.get('*/api/v1/projects/12/resources', () => HttpResponse.json(envelope([]))),
      http.get('*/api/v1/projects/12/searches', () => HttpResponse.json(envelope([]))),
    )
    await open('/projects/12/copy')
    expect(await screen.findByText(/you have no other project to copy into/i)).toBeInTheDocument()
  })
})
