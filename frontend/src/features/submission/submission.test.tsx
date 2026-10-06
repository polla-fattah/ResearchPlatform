import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { envelope, mockMe, renderApp } from '@/test/helpers'
import { mockProjectApis, projectDetail } from '@/test/projectMocks'
import { server } from '@/test/server'

const pg = (n: number) => ({ pagination: { current_page: 1, per_page: 100, total_items: n, total_pages: 1, has_more: false } })

const doc = (id: number, title: string, withVersion = true) => ({
  id,
  project_id: 12,
  title,
  document_type: 'article',
  language: 'en',
  latest_version: withVersion ? { id: id * 10, document_id: id, version_number: 16, content: 'text' } : null,
})

const submission = (over: Record<string, unknown> = {}) => ({
  id: 7,
  project_id: 12,
  version_number: 1,
  title: 'The Kufan routes',
  abstract: 'Of 14 occurrences, 11 preserve only the threefold wording.',
  keywords: ['isnad'],
  rights_declaration: 'CC-BY-4.0',
  coi_declared: true,
  package_checksum: 'abcdef0123456789abcdef',
  status: 'submitted',
  submitted_at: '2026-10-02T09:00:00Z',
  reviews: [],
  decision: null,
  ...over,
})

interface Apis {
  submissions?: Record<string, unknown>[]
  documents?: Record<string, unknown>[]
  detail?: Record<string, unknown>
  validate?: (ids: number[]) => Record<string, unknown>
  create?: (body: Record<string, unknown>) => Response | undefined
}

function mockSubmission(o: Apis = {}) {
  const calls = { validated: [] as number[][], created: [] as Record<string, unknown>[], docsListed: 0 }
  const submissions = o.submissions ?? []
  mockProjectApis(12, { detail: o.detail ?? projectDetail() })
  server.use(
    http.get('*/api/v1/projects/12/submissions', () => HttpResponse.json(envelope(submissions))),
    http.get('*/api/v1/projects/12/documents', () => {
      calls.docsListed++
      const docs = o.documents ?? [doc(3, 'The Kufan routes: main article'), doc(4, 'Notes', false)]
      return HttpResponse.json(envelope(docs, pg(docs.length)))
    }),
    http.post('*/api/v1/projects/12/validate-pre-publication', async ({ request }) => {
      const body = (await request.json()) as { document_ids: number[] }
      calls.validated.push(body.document_ids)
      const out = o.validate?.(body.document_ids) ?? { is_valid: true, issue_count: 0, issues: [] }
      return HttpResponse.json(envelope(out))
    }),
    http.post('*/api/v1/projects/12/submissions', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.created.push(body)
      const custom = o.create?.(body)
      if (custom) return custom
      submissions.push(submission({ id: 8, version_number: submissions.length + 1, title: body.title, status: 'submitted' }))
      return HttpResponse.json(envelope(submission({ id: 8, title: body.title })), { status: 201 })
    }),
  )
  return calls
}

const asResearcher = { detail: projectDetail({ owner_id: 2, owner: { id: 2, display_name: 'Aras Kamal' }, memberships: [{ user_id: 1, role: 'researcher', status: 'accepted' }] }) }

async function fillForm(opts: { chooseDocument?: boolean } = {}) {
  const form = await screen.findByRole('form', { name: 'Submission package' })
  if (opts.chooseDocument !== false) await userEvent.click(await within(form).findByRole('checkbox', { name: /The Kufan routes: main article/ }))
  await userEvent.type(within(form).getByLabelText(/^Abstract/), 'Of 14 occurrences, 11 preserve only the threefold wording.')
  await userEvent.click(within(form).getByRole('checkbox', { name: /quoted source passages/ }))
  await userEvent.click(within(form).getByRole('checkbox', { name: /declared every conflict/ }))
  return form
}

describe('Submission (owner, first package)', () => {
  it('lists documents, disables one with no saved version, and says all findings are included', async () => {
    mockMe()
    mockSubmission()
    renderApp('/projects/12/submission', { signedIn: true })
    const form = await screen.findByRole('form', { name: 'Submission package' })
    expect(await within(form).findByRole('checkbox', { name: /The Kufan routes: main article/ })).toBeEnabled()
    expect(within(form).getByRole('checkbox', { name: /Notes/ })).toBeDisabled()
    expect(within(form).getByText(/No saved version yet, so it cannot be included/)).toBeInTheDocument()
    expect(await within(form).findByText(/All 6 findings of the project are included/)).toBeInTheDocument()
    expect(screen.getByText('Nothing submitted yet')).toBeInTheDocument()
  })

  it('asks the server to check the chosen documents, and cannot freeze until every part is in place', async () => {
    mockMe()
    const calls = mockSubmission()
    renderApp('/projects/12/submission', { signedIn: true })
    const form = await screen.findByRole('form', { name: 'Submission package' })
    const freeze = within(form).getByRole('button', { name: 'Freeze and submit…' })
    expect(freeze).toBeDisabled()
    expect(within(form).getByText('Choose a document to see what needs fixing.')).toBeInTheDocument()
    await userEvent.click(await within(form).findByRole('checkbox', { name: /The Kufan routes: main article/ }))
    await waitFor(() => expect(calls.validated).toEqual([[3]]))
    expect(await within(form).findByText('Nothing to fix. The package passed the check.')).toBeInTheDocument()
    expect(freeze).toBeDisabled()
    await fillForm({ chooseDocument: false })
    await waitFor(() => expect(freeze).toBeEnabled())
  })

  it('blocks on errors, with a link to fix each, and allows notes', async () => {
    mockMe()
    mockSubmission({
      validate: () => ({ is_valid: false, issue_count: 2, issues: [{ code: 'INTERNAL_PRIVATE_LINK', severity: 'error', document_id: 3, message: 'x' }, { code: 'NO_DOCUMENTS', severity: 'warning', message: 'y' }] }),
    })
    renderApp('/projects/12/submission', { signedIn: true })
    const form = await fillForm()
    expect(await within(form).findByText('Cannot submit yet: 1 thing to fix')).toBeInTheDocument()
    const links = within(form).getAllByRole('link', { name: 'Go and fix it' })
    expect(links.map((l) => l.getAttribute('href'))).toContain('/projects/12/findings?doc=3')
    expect(within(form).getByRole('button', { name: 'Freeze and submit…' })).toBeDisabled()
  })

  it('says what is frozen, then submits with every choice explicit and never the bypass', async () => {
    mockMe()
    const calls = mockSubmission()
    renderApp('/projects/12/submission', { signedIn: true })
    const form = await fillForm()
    await userEvent.type(within(form).getByLabelText(/Keywords/), 'isnad, wuḍūʾ')
    await waitFor(() => expect(within(form).getByRole('button', { name: 'Freeze and submit…' })).toBeEnabled())
    await userEvent.click(within(form).getByRole('button', { name: 'Freeze and submit…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Freeze this package and submit?' })
    expect(within(dialog).getByText(/Later edits do not change this package/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Nothing is public until an editor approves/)).toBeInTheDocument()
    expect(calls.created).toEqual([])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Freeze and submit' }))
    await waitFor(() => expect(calls.created).toHaveLength(1))
    expect(calls.created[0]).toEqual({
      title: 'Chains of the wuḍūʾ reports in the Sunan collections',
      abstract: 'Of 14 occurrences, 11 preserve only the threefold wording.',
      document_ids: [3],
      keywords: ['isnad', 'wuḍūʾ'],
      rights_declaration: 'CC-BY-4.0',
      coi_declared: true,
    })
    expect(calls.created[0]).not.toHaveProperty('bypass_warnings')
    expect(await screen.findByRole('table', { name: 'Packages' })).toBeInTheDocument()
    expect(await screen.findByText(/A package is waiting for an editor/)).toBeInTheDocument()
  })

  it('shows why the server refused, and keeps everything typed', async () => {
    mockMe()
    mockSubmission({ create: () => HttpResponse.json({ success: false, error: { code: 'VALIDATION_FAILED', message: 'Pre-publication validation failed (WRT-07). Resolve dependencies before submission.' } }, { status: 422 }) })
    renderApp('/projects/12/submission', { signedIn: true })
    const form = await fillForm()
    await userEvent.click(within(form).getByRole('button', { name: 'Freeze and submit…' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Freeze and submit' }))
    expect(await screen.findByText(/Pre-publication validation failed/)).toBeInTheDocument()
    expect(within(form).getByLabelText(/^Abstract/)).toHaveValue('Of 14 occurrences, 11 preserve only the threefold wording.')
  })

  it('does not offer a package for a project with no documents', async () => {
    mockMe()
    mockSubmission({ documents: [] })
    renderApp('/projects/12/submission', { signedIn: true })
    expect(await screen.findByText(/This project has no documents/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Freeze and submit…' })).toBeDisabled()
  })
})

describe('Submission (packages and workflow)', () => {
  it('lists packages with status and the editor’s note, and never names a reviewer or shows what one wrote', async () => {
    mockMe()
    mockSubmission({
      submissions: [
        submission({
          status: 'revision_requested',
          reviews: [{ id: 1, reviewer_id: 55, reviewer_notes: 'SECRET REVIEWER NOTE', score: 2, completed_at: '2026-10-04T10:00:00Z', reviewer: { id: 55, display_name: 'Dr Hidden Reviewer', email: 'hidden@example.org' } }],
          decision: { decision: 'request_revisions', decision_notes: 'Please add a limitations section.', decided_at: '2026-10-05T10:00:00Z', editor: { id: 9, display_name: 'Editor Person', email: 'editor@example.org' } },
        }),
      ],
    })
    renderApp('/projects/12/submission', { signedIn: true })
    const table = await screen.findByRole('table', { name: 'Packages' })
    expect(within(table).getByText('SUB-0007')).toBeInTheDocument()
    expect(within(table).getByText('Revisions requested')).toBeInTheDocument()
    expect(within(table).getByText('1 review finished')).toBeInTheDocument()
    expect(within(table).getAllByText(/Please add a limitations section/).length).toBeGreaterThan(0)
    expect(within(table).getByText('abcdef012345')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/SECRET REVIEWER NOTE|Dr Hidden Reviewer|hidden@example.org|Editor Person|editor@example.org/)
  })

  it('answers a revision request: the editor’s letter, a required response, and the parent package in the payload', async () => {
    mockMe()
    const calls = mockSubmission({
      submissions: [submission({ status: 'revision_requested', decision: { decision: 'request_revisions', decision_notes: 'Please add a limitations section.' } })],
    })
    renderApp('/projects/12/submission', { signedIn: true })
    const form = await screen.findByRole('form', { name: 'Submission package' })
    expect(within(form).getByRole('heading', { name: 'Revisions were requested' })).toBeInTheDocument()
    expect(within(form).getByLabelText(/^Title/)).toHaveValue('The Kufan routes')
    await userEvent.click(await within(form).findByRole('checkbox', { name: /The Kufan routes: main article/ }))
    await userEvent.click(within(form).getByRole('checkbox', { name: /quoted source passages/ }))
    await userEvent.click(within(form).getByRole('checkbox', { name: /declared every conflict/ }))
    await waitFor(() => expect(calls.validated.length).toBeGreaterThan(0))
    expect(await within(form).findByText('Nothing to fix. The package passed the check.')).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Freeze and resubmit…' })).toBeDisabled()
    await userEvent.type(within(form).getByLabelText(/Your response/), 'Added section 5.')
    await waitFor(() => expect(within(form).getByRole('button', { name: 'Freeze and resubmit…' })).toBeEnabled())
    await userEvent.click(within(form).getByRole('button', { name: 'Freeze and resubmit…' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Freeze and submit' }))
    await waitFor(() => expect(calls.created[0]).toMatchObject({ parent_submission_id: 7, author_response_notes: 'Added section 5.' }))
  })

  it('offers no new package while one waits, and explains why', async () => {
    mockMe()
    const calls = mockSubmission({ submissions: [submission({ status: 'in_review' })] })
    renderApp('/projects/12/submission', { signedIn: true })
    expect(await screen.findByText(/A package is waiting for an editor or under review/)).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Submission package' })).not.toBeInTheDocument()
    expect(calls.docsListed).toBe(0)
  })

  it.each([
    ['approved', /was approved/],
    ['rejected', /was rejected/],
  ])('says so, and offers no new package, when the latest was %s', async (status, text) => {
    mockMe()
    mockSubmission({ submissions: [submission({ status })] })
    renderApp('/projects/12/submission', { signedIn: true })
    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Submission package' })).not.toBeInTheDocument()
  })

  it('lets a researcher read the packages but not build one, and never asks for documents', async () => {
    mockMe()
    const calls = mockSubmission({ ...asResearcher, submissions: [submission()] })
    renderApp('/projects/12/submission', { signedIn: true })
    expect(await screen.findByRole('table', { name: 'Packages' })).toBeInTheDocument()
    expect(screen.getByText(/Only the project owner can submit for publication/)).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Submission package' })).not.toBeInTheDocument()
    expect(calls.docsListed).toBe(0)
  })

  it('shows an error with a retry when the packages cannot load', async () => {
    mockMe()
    mockSubmission()
    server.use(http.get('*/api/v1/projects/12/submissions', () => HttpResponse.json({ success: false, error: { code: 'ERROR', message: 'x' } }, { status: 500 })))
    renderApp('/projects/12/submission', { signedIn: true })
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
