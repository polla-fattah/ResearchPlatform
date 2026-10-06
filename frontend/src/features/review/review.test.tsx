import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { envelope, mockMe, renderApp } from '@/test/helpers'
import { server } from '@/test/server'

const pack = {
  abstract: 'Of 14 occurrences, 11 preserve only the threefold wording.',
  exported_at: '2026-10-02T09:00:00Z',
  project: { id: 12, title: 'SECRET PROJECT TITLE', question: 'q', scope: 'SECRET SCOPE', owner_id: 2, owner: { id: 2, display_name: 'Shilan Rashid', email: 'shilan@example.org' } },
  documents: [{ id: 3, project_id: 12, title: 'Main article', document_type: 'article', latest_version: { version_number: 16, content: '# Introduction\n\nThe Kufan routes share a common link.', author_id: 2, citations: [{ id: 1, collector_id: 2 }, { id: 2 }] } }],
  findings: [
    { id: 4, claim: 'The expansion is a later development.', reasoning: 'It appears only on the Wakīʿ route.', limitations: null, status: 'provisional', evidence_items: [{ id: 9, collector_id: 2, collector: { email: 'shilan@example.org' } }] },
    { id: 5, claim: 'A second claim.', reasoning: null, limitations: 'Small sample.', status: 'supported', evidence_items: [] },
  ],
}

const assignment = (over: Record<string, unknown> = {}) => ({
  id: 3,
  recommendation: null,
  score: null,
  reviewer_notes: null,
  coi_confirmed: true,
  due_date: '2099-01-01T00:00:00Z',
  completed_at: null,
  created_at: '2026-10-02T09:00:00Z',
  submission: {
    id: 7,
    title: 'The Kufan routes',
    abstract: 'Of 14 occurrences…',
    version_number: 2,
    status: 'in_review',
    project_id: 12,
    submitted_by: 2,
    submitter: { id: 2, display_name: 'Shilan Rashid', email: 'shilan@example.org' },
    frozen_package: pack,
  },
  ...over,
})

interface Apis {
  list?: Record<string, unknown>[]
  one?: Record<string, unknown>
  send?: () => Response | undefined
}

function mockReview(o: Apis = {}) {
  const calls = { declared: [] as Record<string, unknown>[], accepted: 0, declined: 0, sent: [] as Record<string, unknown>[] }
  let current = o.one ?? assignment()
  const list = o.list ?? [assignment(), assignment({ id: 4, due_date: '2020-01-01T00:00:00Z', submission: { id: 8, title: 'Another package', version_number: 1 } }), assignment({ id: 5, completed_at: '2026-10-04T10:00:00Z', due_date: '2020-01-01T00:00:00Z', submission: { id: 9, title: 'Done package', version_number: 1 } })]
  server.use(
    http.get('*/api/v1/reviews/assignments', () => HttpResponse.json(envelope(list))),
    http.get('*/api/v1/reviews/assignments/:id', () => HttpResponse.json(envelope(current))),
    http.post('*/api/v1/reviews/assignments/:id/coi-declaration', async ({ request }) => {
      calls.declared.push((await request.json()) as Record<string, unknown>)
      return HttpResponse.json(envelope(assignment({ coi_confirmed: true })))
    }),
    http.post('*/api/v1/reviews/assignments/:id/accept', () => {
      calls.accepted++
      return HttpResponse.json(envelope(assignment()))
    }),
    http.post('*/api/v1/reviews/assignments/:id/decline', () => {
      calls.declined++
      return HttpResponse.json(envelope(null))
    }),
    http.post('*/api/v1/reviews/assignments/:id/recommendation', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.sent.push(body)
      const custom = o.send?.()
      if (custom) return custom
      current = assignment({ recommendation: body.recommendation, score: body.score ?? null, reviewer_notes: body.reviewer_notes, completed_at: '2026-10-06T10:00:00Z' })
      return HttpResponse.json(envelope(current))
    }),
  )
  return calls
}

describe('Peer review list', () => {
  it('lists the packages the person was asked to review, with state and due day', async () => {
    mockMe()
    mockReview()
    renderApp('/review', { signedIn: true })
    const table = await screen.findByRole('table', { name: 'Peer review' })
    const first = within(table).getByRole('row', { name: /The Kufan routes/ })
    expect(within(first).getByText('To review')).toBeInTheDocument()
    expect(within(first).getByText('SUB-0007')).toBeInTheDocument()
    expect(within(within(table).getByRole('row', { name: /Another package/ })).getByText('Overdue')).toBeInTheDocument()
    const done = within(table).getByRole('row', { name: /Done package/ })
    expect(within(done).getByText('Review sent')).toBeInTheDocument()
    expect(within(done).queryByText('Overdue')).not.toBeInTheDocument()
  })

  it('says there is nothing, and is in the rail for every researcher', async () => {
    mockMe()
    mockReview({ list: [] })
    renderApp('/review', { signedIn: true })
    expect(await screen.findByText('Nothing to review')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Peer review' })).toHaveAttribute('href', '/review')
  })

  it('shows an error with a retry', async () => {
    mockMe()
    mockReview()
    server.use(http.get('*/api/v1/reviews/assignments', () => HttpResponse.json({ success: false, error: { code: 'ERROR', message: 'x' } }, { status: 500 })))
    renderApp('/review', { signedIn: true })
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

describe('Peer review: the package', () => {
  it('asks for a declaration of no conflict before showing anything of the package', async () => {
    mockMe()
    mockReview()
    renderApp('/review/3', { signedIn: true })
    expect(await screen.findByRole('region', { name: 'Before you open the package' })).toBeInTheDocument()
    expect(screen.queryByText('The expansion is a later development.')).not.toBeInTheDocument()
    const open = screen.getByRole('button', { name: 'No conflict: open the package' })
    expect(open).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: /no conflict of interest/ }))
    expect(open).toBeEnabled()
  })

  it('records the declaration and the acceptance, then shows the package', async () => {
    mockMe()
    const calls = mockReview()
    renderApp('/review/3', { signedIn: true })
    await userEvent.click(await screen.findByRole('checkbox', { name: /no conflict of interest/ }))
    await userEvent.click(screen.getByRole('button', { name: 'No conflict: open the package' }))
    expect(await screen.findByRole('region', { name: 'Abstract' })).toHaveTextContent('Of 14 occurrences, 11 preserve only the threefold wording.')
    expect(calls.declared).toEqual([{ coi_confirmed: true }])
    expect(calls.accepted).toBe(1)
    expect(screen.getByRole('heading', { name: 'Main article' })).toBeInTheDocument()
    expect(screen.getByText('The Kufan routes share a common link.')).toBeInTheDocument()
    expect(screen.getByText('The expansion is a later development.')).toBeInTheDocument()
    expect(screen.getByText('No limitations written.')).toBeInTheDocument()
    expect(screen.getByText('Small sample.')).toBeInTheDocument()
    expect(screen.getByText(/Included in this package: 1 document\(s\), 2 finding\(s\), 2 citation\(s\)/)).toBeInTheDocument()
  })

  it('never shows who the authors are or what project the package came from', async () => {
    mockMe()
    mockReview()
    renderApp('/review/3', { signedIn: true })
    await userEvent.click(await screen.findByRole('checkbox', { name: /no conflict of interest/ }))
    await userEvent.click(screen.getByRole('button', { name: 'No conflict: open the package' }))
    await screen.findByRole('region', { name: 'Abstract' })
    // The page's own text, not the rail (which names the signed-in reviewer, who happens to share a name in this fixture).
    const text = screen.getByRole('main').textContent ?? ''
    expect(text).not.toMatch(/Shilan Rashid|shilan@example\.org|SECRET PROJECT TITLE|SECRET SCOPE/)
    expect(text).not.toMatch(/PRJ-/)
  })

  it('declines after a confirmation and goes back to the list', async () => {
    mockMe()
    const calls = mockReview()
    const { router } = renderApp('/review/3', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Decline this review' }))
    const dialog = await screen.findByRole('dialog', { name: 'Decline this review?' })
    expect(calls.declined).toBe(0)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Decline' }))
    await waitFor(() => expect(calls.declined).toBe(1))
    await waitFor(() => expect(router.state.location.pathname).toBe('/review'))
  })

  it('sends the review after a confirmation, with the recommendation, the score and the notes, and then shows it as sent', async () => {
    mockMe()
    const calls = mockReview()
    renderApp('/review/3', { signedIn: true })
    await userEvent.click(await screen.findByRole('checkbox', { name: /no conflict of interest/ }))
    await userEvent.click(screen.getByRole('button', { name: 'No conflict: open the package' }))
    const form = await screen.findByRole('form', { name: 'Your review' })
    const submit = within(form).getByRole('button', { name: 'Submit review…' })
    expect(submit).toBeDisabled()
    await userEvent.click(within(form).getByRole('radio', { name: 'Recommend revisions' }))
    await userEvent.type(within(form).getByLabelText(/^Your review/), 'short')
    expect(await within(form).findByText('Write at least 10 characters')).toBeInTheDocument()
    expect(submit).toBeDisabled()
    await userEvent.clear(within(form).getByLabelText(/^Your review/))
    await userEvent.type(within(form).getByLabelText(/^Your review/), 'One citation still lacks a page.')
    await userEvent.selectOptions(within(form).getByLabelText(/Score/), '7')
    await userEvent.click(submit)
    const dialog = await screen.findByRole('dialog', { name: 'Submit your review?' })
    expect(calls.sent).toEqual([])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Submit review' }))
    await waitFor(() => expect(calls.sent).toEqual([{ recommendation: 'request_revisions', score: 7, reviewer_notes: 'One citation still lacks a page.', coi_confirmed: true }]))
    const sent = await screen.findByRole('status', { name: 'Your review was sent' })
    expect(within(sent).getByText(/Recommend revisions · score 7/)).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Your review' })).not.toBeInTheDocument()
  })

  it('keeps what was written and says it was not sent when the server fails', async () => {
    mockMe()
    mockReview({ send: () => HttpResponse.json({ success: false, error: { code: 'ERROR', message: 'boom' } }, { status: 500 }) })
    renderApp('/review/3', { signedIn: true })
    await userEvent.click(await screen.findByRole('checkbox', { name: /no conflict of interest/ }))
    await userEvent.click(screen.getByRole('button', { name: 'No conflict: open the package' }))
    const form = await screen.findByRole('form', { name: 'Your review' })
    await userEvent.click(within(form).getByRole('radio', { name: 'Recommend approval' }))
    await userEvent.type(within(form).getByLabelText(/^Your review/), 'Sound and clearly argued.')
    await userEvent.click(within(form).getByRole('button', { name: 'Submit review…' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Submit review' }))
    expect(await screen.findByText(/The review was not sent/)).toBeInTheDocument()
    expect(within(form).getByLabelText(/^Your review/)).toHaveValue('Sound and clearly argued.')
  })

  it('shows a finished review as it was sent, with the package, and no gate and no form', async () => {
    mockMe()
    mockReview({ one: assignment({ recommendation: 'approve', score: 8, reviewer_notes: 'Sound and clearly argued.', completed_at: '2026-10-04T10:00:00Z' }) })
    renderApp('/review/3', { signedIn: true })
    const sent = await screen.findByRole('status', { name: 'Your review was sent' })
    expect(within(sent).getByText('Sound and clearly argued.')).toBeInTheDocument()
    expect(screen.getByText('The expansion is a later development.')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Before you open the package' })).not.toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Your review' })).not.toBeInTheDocument()
  })

  it('says a review that is not assigned to the person is not available', async () => {
    mockMe()
    mockReview()
    server.use(http.get('*/api/v1/reviews/assignments/3', () => HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'x' } }, { status: 404 })))
    renderApp('/review/3', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'This review is not available' })).toBeInTheDocument()
  })
})
