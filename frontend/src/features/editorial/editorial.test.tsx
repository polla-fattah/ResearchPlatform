import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { envelope, mockMe, renderApp } from '@/test/helpers'
import { server } from '@/test/server'

const pg = (n: number) => ({ pagination: { current_page: 1, per_page: 20, total_items: n, total_pages: Math.max(1, Math.ceil(n / 20)), has_more: n > 20 } })

const review = (over: Record<string, unknown> = {}) => ({
  id: 1,
  reviewer_id: 55,
  recommendation: 'request_revisions',
  score: 6,
  reviewer_notes: 'The Ibn ʿUyayna reading needs an argument.',
  coi_confirmed: true,
  due_date: '2026-10-20T00:00:00Z',
  completed_at: '2026-10-04T10:00:00Z',
  reviewer: { id: 55, display_name: 'Dr Leyla Mustafa' },
  ...over,
})

const submission = (over: Record<string, unknown> = {}) => ({
  id: 7,
  project_id: 12,
  version_number: 1,
  title: 'The Kufan routes',
  abstract: 'Of 14 occurrences, 11 preserve only the threefold wording.',
  keywords: ['isnad'],
  rights_declaration: 'CC-BY-4.0',
  author_response_notes: null,
  package_checksum: 'abcdef0123456789',
  status: 'in_review',
  submitted_at: '2026-10-02T09:00:00Z',
  project: { id: 12, title: 'Chains', owner: { id: 2, display_name: 'Shilan Rashid' } },
  submitter: { id: 2, display_name: 'Shilan Rashid' },
  reviews: [review()],
  decision: null,
  publication: null,
  frozen_package: { huge: 'never kept' },
  ...over,
})

const candidate = (id: number, over: Record<string, unknown> = {}) => ({ id, display_name: `Scholar ${id}`, affiliation: 'Soran University', prior_reviews_count: 2, coi: { blocked: false, reason: null }, ...over })

interface Apis {
  queue?: Record<string, unknown>[]
  one?: Record<string, unknown>
  candidates?: Record<string, unknown>[]
  decide?: () => Response | undefined
}

function mockEditorial(o: Apis = {}) {
  let current = o.one ?? submission()
  const calls = {
    queue: [] as URLSearchParams[],
    assigned: [] as Record<string, unknown>[],
    decided: [] as Record<string, unknown>[],
    released: [] as Record<string, unknown>[],
    corrigenda: [] as Record<string, unknown>[],
    retracted: [] as Record<string, unknown>[],
  }
  const queue = o.queue ?? [submission(), submission({ id: 8, title: 'Second package', status: 'submitted', reviews: [] }), submission({ id: 9, title: 'Third', status: 'revision_requested' })]
  server.use(
    http.get('*/api/v1/editor/submissions', ({ request }) => {
      calls.queue.push(new URL(request.url).searchParams)
      return HttpResponse.json(envelope(queue, pg(queue.length)))
    }),
    http.get('*/api/v1/editor/submissions/:id', () => HttpResponse.json(envelope(current))),
    http.get('*/api/v1/editor/submissions/:id/reviewer-candidates', () =>
      HttpResponse.json(envelope(o.candidates ?? [candidate(60), candidate(61, { coi: { blocked: true, reason: 'Conflict: author or project team member on PRJ-12' } }), candidate(55, { display_name: 'Dr Leyla Mustafa' })])),
    ),
    http.post('*/api/v1/editor/submissions/:id/assign', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.assigned.push(body)
      return HttpResponse.json(envelope(review({ id: 2, reviewer_id: body.reviewer_id, completed_at: null })), { status: 201 })
    }),
    http.post('*/api/v1/editor/submissions/:id/decision', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.decided.push(body)
      const custom = o.decide?.()
      if (custom) return custom
      const status = { approve: 'approved', request_revisions: 'revision_requested', reject: 'rejected' }[String(body.decision)]
      current = { ...current, status }
      return HttpResponse.json(envelope({ decision: { decision: body.decision }, submission_status: status }))
    }),
    http.post('*/api/v1/editor/submissions/:id/release', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.released.push(body)
      current = { ...current, publication: { id: 3, public_slug: body.public_slug, status: 'published', version_string: body.version_string ?? '1.0.0', doi: '10.5281/openhadith.7.1', license: 'CC-BY-4.0', released_at: '2026-10-06T10:00:00Z' } }
      return HttpResponse.json(envelope(current.publication), { status: 201 })
    }),
    http.post('*/api/v1/editor/publications/:id/corrigenda', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.corrigenda.push(body)
      return HttpResponse.json(envelope({ id: 3, status: 'published', version_string: body.new_version_string }))
    }),
    http.post('*/api/v1/editor/publications/:id/retract', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.retracted.push(body)
      return HttpResponse.json(envelope({ id: 3, status: 'retracted', retraction_reason: body.retraction_reason }))
    }),
  )
  return calls
}

const editor = { roles: ['editor'], id: 9 }

describe('Editorial console: access', () => {
  it('shows an ordinary researcher the same page as an address that does not exist', async () => {
    mockMe()
    mockEditorial()
    renderApp('/editor', { signedIn: true })
    expect(await screen.findByRole('heading', { name: /That page isn.t available/ })).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Submissions' })).not.toBeInTheDocument()
  })

  it('shows an editor the queue, and the link in the rail', async () => {
    mockMe(editor)
    mockEditorial()
    renderApp('/editor', { signedIn: true })
    expect(await screen.findByRole('table', { name: 'Submissions' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Editorial' })).toHaveAttribute('href', '/editor')
  })

  it('also lets an administrator in', async () => {
    mockMe({ is_admin: true })
    mockEditorial()
    renderApp('/editor', { signedIn: true })
    expect(await screen.findByRole('table', { name: 'Submissions' })).toBeInTheDocument()
  })
})

describe('Editorial console: queue', () => {
  it('lists packages with stage, finished reviews and who it is waiting on, and never keeps the frozen package', async () => {
    mockMe(editor)
    mockEditorial()
    renderApp('/editor', { signedIn: true })
    const table = await screen.findByRole('table', { name: 'Submissions' })
    const first = within(table).getByRole('row', { name: /The Kufan routes/ })
    expect(within(first).getByText('SUB-0007')).toBeInTheDocument()
    expect(within(first).getByText('Ready for decision')).toBeInTheDocument()
    expect(within(first).getByText('1 of 1 finished')).toBeInTheDocument()
    expect(within(first).getByText('An editor: decide')).toBeInTheDocument()
    const second = within(table).getByRole('row', { name: /Second package/ })
    expect(within(second).getByText('An editor: assign a reviewer')).toBeInTheDocument()
    const third = within(table).getByRole('row', { name: /Third/ })
    expect(within(third).getByText('The authors')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('never kept')
  })

  it('sends the stage, the action, the words and the page to the server, all in the address', async () => {
    mockMe(editor)
    const calls = mockEditorial()
    const { router } = renderApp('/editor', { signedIn: true })
    await screen.findByRole('table', { name: 'Submissions' })
    await userEvent.click(screen.getByRole('button', { name: 'Ready for decision' }))
    await userEvent.selectOptions(screen.getByLabelText('Action needed'), 'Decide')
    await userEvent.type(screen.getByRole('searchbox'), 'kufan{Enter}')
    await waitFor(() => {
      const q = calls.queue.at(-1)!
      expect(q.get('stage')).toBe('ready_for_decision')
      expect(q.get('action_required')).toBe('editor_decision')
      expect(q.get('q')).toBe('kufan')
    })
    expect(router.state.location.search).toBe('?stage=ready_for_decision&action=editor_decision&q=kufan')
  })

  it('says there is nothing, and when filters match nothing', async () => {
    mockMe(editor)
    mockEditorial({ queue: [] })
    renderApp('/editor', { signedIn: true })
    expect(await screen.findByText('No submissions yet')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Under review' }))
    expect(await screen.findByText('No submissions match these filters')).toBeInTheDocument()
  })

  it('shows an error with a retry when the queue cannot load', async () => {
    mockMe(editor)
    mockEditorial()
    server.use(http.get('*/api/v1/editor/submissions', () => HttpResponse.json({ success: false, error: { code: 'ERROR', message: 'x' } }, { status: 500 })))
    renderApp('/editor', { signedIn: true })
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

describe('Editorial console: a case', () => {
  it('shows the package, every review with who wrote it (an editor may), and the next step', async () => {
    mockMe(editor)
    mockEditorial()
    renderApp('/editor/7', { signedIn: true })
    expect(await screen.findByRole('heading', { level: 1, name: 'The Kufan routes' })).toBeInTheDocument()
    const reviews = screen.getByRole('region', { name: 'Reviews' })
    expect(within(reviews).getByText('Dr Leyla Mustafa')).toBeInTheDocument()
    expect(within(reviews).getByText('The Ibn ʿUyayna reading needs an argument.')).toBeInTheDocument()
    expect(within(reviews).getByText(/Recommends revisions/)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Package' })).toHaveTextContent('abcdef0123456789')
    expect(screen.getByRole('form', { name: 'Decision on SUB-0007' })).toBeInTheDocument()
  })

  it('assigns a reviewer: a candidate with a conflict or one already assigned cannot be chosen, and the editor confirms no conflict', async () => {
    mockMe(editor)
    const calls = mockEditorial()
    renderApp('/editor/7', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Choose a reviewer…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Assign a reviewer' })
    expect(await within(dialog).findByRole('radio', { name: /Scholar 61/ })).toBeDisabled()
    expect(within(dialog).getByText(/Conflict: author or project team member on PRJ-12/)).toBeInTheDocument()
    expect(within(dialog).getByRole('radio', { name: /Dr Leyla Mustafa/ })).toBeDisabled()
    expect(within(dialog).getByText('Already assigned to this package')).toBeInTheDocument()
    const submit = within(dialog).getByRole('button', { name: 'Assign reviewer' })
    expect(submit).toBeDisabled()
    await userEvent.click(within(dialog).getByRole('radio', { name: /Scholar 60/ }))
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /no conflict of interest/ }))
    await userEvent.type(within(dialog).getByLabelText(/Due/), '2099-01-01')
    await userEvent.click(submit)
    await waitFor(() => expect(calls.assigned).toEqual([{ reviewer_id: 60, due_date: '2099-01-01', coi_confirmed: true }]))
  })

  it('finds a candidate by name', async () => {
    mockMe(editor)
    mockEditorial()
    renderApp('/editor/7', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Choose a reviewer…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Assign a reviewer' })
    await within(dialog).findByRole('radio', { name: /Scholar 60/ })
    await userEvent.type(within(dialog).getByRole('searchbox'), 'Leyla')
    expect(within(dialog).queryByRole('radio', { name: /Scholar 60/ })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('radio', { name: /Dr Leyla Mustafa/ })).toBeInTheDocument()
  })

  it('decides after a confirmation: the reason is required, the conflict is declared, and approving is never overridden', async () => {
    mockMe(editor)
    const calls = mockEditorial()
    renderApp('/editor/7', { signedIn: true })
    const form = await screen.findByRole('form', { name: 'Decision on SUB-0007' })
    const submit = within(form).getByRole('button', { name: 'Record decision…' })
    expect(submit).toBeDisabled()
    await userEvent.click(within(form).getByRole('radio', { name: 'Request revisions' }))
    await userEvent.type(within(form).getByLabelText(/Reason or message/), 'short')
    expect(await within(form).findByText('Write at least 10 characters')).toBeInTheDocument()
    await userEvent.clear(within(form).getByLabelText(/Reason or message/))
    await userEvent.type(within(form).getByLabelText(/Reason or message/), 'Please add a limitations section.')
    await userEvent.click(within(form).getByRole('checkbox', { name: /no conflict of interest/ }))
    await userEvent.click(submit)
    const dialog = await screen.findByRole('dialog', { name: 'Request revisions on SUB-0007?' })
    expect(calls.decided).toEqual([])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Request revisions' }))
    await waitFor(() => expect(calls.decided).toEqual([{ decision: 'request_revisions', decision_notes: 'Please add a limitations section.', coi_confirmed: true }]))
    expect(calls.decided[0]).not.toHaveProperty('override_peer_review')
  })

  it('turns approval off, and says why, until a review is finished', async () => {
    mockMe(editor)
    mockEditorial({ one: submission({ reviews: [review({ completed_at: null })] }) })
    renderApp('/editor/7', { signedIn: true })
    const form = await screen.findByRole('form', { name: 'Decision on SUB-0007' })
    expect(within(form).getByRole('radio', { name: /Approve/ })).toBeDisabled()
    expect(within(form).getByText('Needs at least one finished review.')).toBeInTheDocument()
    expect(within(form).getByRole('radio', { name: 'Reject with reason' })).toBeEnabled()
  })

  it('shows the server’s reason when it refuses, and keeps what was typed', async () => {
    mockMe(editor)
    mockEditorial({ decide: () => HttpResponse.json({ success: false, error: { code: 'CONFLICT_OF_INTEREST', message: 'Conflict of interest: Authors or project team members cannot make editorial decisions on their own submissions.' } }, { status: 403 }) })
    renderApp('/editor/7', { signedIn: true })
    const form = await screen.findByRole('form', { name: 'Decision on SUB-0007' })
    await userEvent.click(within(form).getByRole('radio', { name: 'Reject with reason' }))
    await userEvent.type(within(form).getByLabelText(/Reason or message/), 'Out of scope for the journal.')
    await userEvent.click(within(form).getByRole('checkbox', { name: /no conflict of interest/ }))
    await userEvent.click(within(form).getByRole('button', { name: 'Record decision…' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reject' }))
    expect(await screen.findByText(/Authors or project team members cannot make editorial decisions/)).toBeInTheDocument()
    expect(within(form).getByLabelText(/Reason or message/)).toHaveValue('Out of scope for the journal.')
  })

  it('blocks the owner or submitter of a package from deciding or assigning on it', async () => {
    mockMe({ roles: ['editor'], id: 2 })
    mockEditorial()
    renderApp('/editor/7', { signedIn: true })
    expect(await screen.findByText(/you are its owner or its submitter/)).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Decision on SUB-0007' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Choose a reviewer…' })).not.toBeInTheDocument()
  })

  it('says a package that was not found is not available', async () => {
    mockMe(editor)
    mockEditorial()
    server.use(http.get('*/api/v1/editor/submissions/7', () => HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'x' } }, { status: 404 })))
    renderApp('/editor/7', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'This submission is not available' })).toBeInTheDocument()
  })
})

describe('Editorial console: release and after', () => {
  const approved = submission({ status: 'approved', decision: { decision: 'approve', decision_notes: 'Sound work.', decided_at: '2026-10-05T10:00:00Z', editor: { display_name: 'Karwan Aziz' } } })

  it('releases an approved package only when its code is typed, with the DOI caution', async () => {
    mockMe(editor)
    const calls = mockEditorial({ one: approved })
    renderApp('/editor/7', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Release…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Release SUB-0007' })
    expect(within(dialog).getByLabelText(/Public address/)).toHaveValue('the-kufan-routes')
    expect(within(dialog).getByText(/not a registered DOI/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Release to the public site' }))
    expect(await within(dialog).findByText('Type SUB-0007 to confirm', { selector: 'span:last-child' })).toBeInTheDocument()
    expect(calls.released).toEqual([])
    await userEvent.type(within(dialog).getByLabelText(/Type SUB-0007 to confirm/), 'sub-0007')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Release to the public site' }))
    await waitFor(() => expect(calls.released).toEqual([{ public_slug: 'the-kufan-routes', version_string: '1.0.0', license: 'CC-BY-4.0' }]))
    expect(await screen.findByRole('region', { name: 'Publication' })).toBeInTheDocument()
  })

  it('offers no release before approval, and none once released', async () => {
    mockMe(editor)
    mockEditorial()
    renderApp('/editor/7', { signedIn: true })
    await screen.findByRole('form', { name: 'Decision on SUB-0007' })
    expect(screen.queryByRole('button', { name: 'Release…' })).not.toBeInTheDocument()
  })

  const published = submission({ status: 'approved', publication: { id: 3, public_slug: 'the-kufan-routes', status: 'published', version_string: '1.0.0', doi: '10.5281/openhadith.7.1', license: 'CC-BY-4.0', released_at: '2026-10-06T10:00:00Z', corrigenda: [] } })

  it('adds a correction notice with a new version, and refuses the same version', async () => {
    mockMe(editor)
    const calls = mockEditorial({ one: published })
    renderApp('/editor/7', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Add a correction…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add a correction notice' })
    await userEvent.type(within(dialog).getByLabelText(/What was corrected/), 'Fixed a citation in section 3.')
    await userEvent.type(within(dialog).getByLabelText(/New version/), '1.0.0')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Publish the correction' }))
    expect(await within(dialog).findByText('Choose a version different from the current one')).toBeInTheDocument()
    await userEvent.clear(within(dialog).getByLabelText(/New version/))
    await userEvent.type(within(dialog).getByLabelText(/New version/), '1.0.1')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Publish the correction' }))
    await waitFor(() => expect(calls.corrigenda).toEqual([{ notice: 'Fixed a citation in section 3.', new_version_string: '1.0.1' }]))
  })

  it('retracts only with a reason of ten characters', async () => {
    mockMe(editor)
    const calls = mockEditorial({ one: published })
    renderApp('/editor/7', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Retract…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Retract this publication' })
    const go = within(dialog).getByRole('button', { name: 'Retract' })
    expect(go).toBeDisabled()
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'A source was misattributed.')
    await userEvent.click(go)
    await waitFor(() => expect(calls.retracted).toEqual([{ retraction_reason: 'A source was misattributed.' }]))
  })

  it('shows a retracted publication with its reason and no way to change it', async () => {
    mockMe(editor)
    mockEditorial({ one: submission({ status: 'approved', publication: { id: 3, public_slug: 's', status: 'retracted', version_string: '1.0.0', retraction_reason: 'A source was misattributed.' } }) })
    renderApp('/editor/7', { signedIn: true })
    expect(await screen.findByText('A source was misattributed.')).toBeInTheDocument()
    expect(screen.getByText('Retracted', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retract…' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add a correction…' })).not.toBeInTheDocument()
  })
})
