import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { adminUser, application, auditEntry, grant, job, mockAdmin, proposal } from '@/test/adminMocks'
import { mockHomeApis, mockMe, renderApp } from '@/test/helpers'

const admin = () => mockMe({ is_admin: true })

describe('Administration: the area', () => {
  it('has its own navigation with the numbers an administrator checks first, and a way back', async () => {
    admin()
    mockAdmin({ applications: [application(), application({ id: 418, user_id: 143 })], users: [adminUser(), adminUser({ id: 8 })], proposals: [proposal()] })
    renderApp('/admin/applications', { signedIn: true })
    const nav = await screen.findByRole('navigation', { name: 'Administration navigation' })
    expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual([
      expect.stringContaining('Applications'),
      expect.stringContaining('Accounts and roles'),
      expect.stringContaining('Corpus corrections'),
      expect.stringContaining('Limits, quotas and jobs'),
      expect.stringContaining('Support access'),
      expect.stringContaining('Audit log'),
      expect.stringContaining('Operations'),
    ])
    expect(await within(nav).findByRole('link', { name: /Applications\s*2/ })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: /Accounts and roles\s*2/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Exit to researcher view' })).toHaveAttribute('href', '/home')
  })

  it('goes to the first view from /admin, and the researcher rail offers it only to administrators', async () => {
    admin()
    mockAdmin()
    const { router } = renderApp('/admin', { signedIn: true })
    await screen.findByRole('heading', { level: 1, name: 'Applications' })
    expect(router.state.location.pathname).toBe('/admin/applications')
  })

  it('does not offer Administration to a researcher', async () => {
    mockMe()
    mockHomeApis()
    renderApp('/home', { signedIn: true })
    await screen.findByRole('heading', { name: /welcome back/i })
    expect(screen.queryByRole('link', { name: 'Administration' })).not.toBeInTheDocument()
  })

  it('offers Administration to an administrator in the researcher rail', async () => {
    admin()
    mockHomeApis()
    renderApp('/home', { signedIn: true })
    expect(await screen.findByRole('link', { name: 'Administration' })).toHaveAttribute('href', '/admin/applications')
  })

  it('shows alerts as a count beside Operations', async () => {
    admin()
    mockAdmin({ ops: { queue_depth: 1, failures_count: 2, storage_used_bytes: 10, active_alerts: [{ severity: 'warning', message: '2 export job failure(s) require administrative review.' }] } })
    renderApp('/admin/applications', { signedIn: true })
    expect(await screen.findByRole('link', { name: /Operations\s*1 alert/ })).toBeInTheDocument()
  })
})

describe('Applications', () => {
  it('lists the applications waiting, oldest information first, and opens one to read', async () => {
    admin()
    mockAdmin()
    renderApp('/admin/applications', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: /Shilan Rashid/ }))
    const detail = await screen.findByRole('article', { name: 'Shilan Rashid' })
    expect(within(detail).getByText('shilan@example.org')).toBeInTheDocument()
    expect(within(detail).getByText(/Takhrīj of reports on ritual purity/)).toBeInTheDocument()
    expect(within(detail).getByText('Sorani')).toBeInTheDocument()
    expect(within(detail).getByText('Not provided (optional)')).toBeInTheDocument()
    expect(within(detail).getByText(/APP-2026-0417/)).toBeInTheDocument()
  })

  it('keeps the chosen application and the state filter in the address', async () => {
    admin()
    mockAdmin()
    const { router } = renderApp('/admin/applications', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: /Shilan Rashid/ }))
    expect(router.state.location.search).toBe('?application=417')
    await userEvent.click(screen.getByRole('button', { name: /Approved/ }))
    await waitFor(() => expect(router.state.location.search).toBe('?status=approved'))
  })

  it('approves after confirmation, with no reason needed, and says it was recorded', async () => {
    admin()
    const { calls } = mockAdmin()
    renderApp('/admin/applications?application=417', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/The account becomes a researcher account/)).toBeInTheDocument()
    expect(calls.decisions).toEqual([])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(calls.decisions).toEqual([{ id: '417', body: { decision: 'approved' } }]))
    expect(await screen.findByText('Decision recorded: approved.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Shilan Rashid' })).not.toBeInTheDocument())
  })

  it('needs a reason of at least five characters to decline, and sends it as the reason', async () => {
    admin()
    const { calls } = mockAdmin()
    renderApp('/admin/applications?application=417', { signedIn: true })
    const decline = await screen.findByRole('button', { name: 'Decline with reason' })
    const ask = screen.getByRole('button', { name: 'Request more information' })
    expect(decline).toBeDisabled()
    expect(ask).toBeDisabled()
    expect(screen.getByText(/A reason or message of at least 5 characters is needed/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/Reason or message/), 'Not enough detail about your research.')
    expect(decline).toBeEnabled()
    await userEvent.click(decline)
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Decline application' }))
    await waitFor(() => expect(calls.decisions).toEqual([{ id: '417', body: { decision: 'rejected', decision_reason: 'Not enough detail about your research.' } }]))
    expect(await screen.findByText('Decision recorded: declined.')).toBeInTheDocument()
  })

  it('asks the applicant for more information with the message the server expects', async () => {
    admin()
    const { calls } = mockAdmin()
    renderApp('/admin/applications?application=417', { signedIn: true })
    await userEvent.type(await screen.findByLabelText(/Reason or message/), 'Describe a recent piece of research.')
    await userEvent.click(screen.getByRole('button', { name: 'Request more information' }))
    await waitFor(() => expect(calls.decisions).toEqual([{ id: '417', body: { decision: 'information_requested', message: 'Describe a recent piece of research.' } }]))
    expect(await screen.findByText('Decision recorded: more information requested.')).toBeInTheDocument()
  })

  it('shows the conversation with an applicant who was asked, and what they replied', async () => {
    admin()
    mockAdmin({
      applications: [
        application({
          status: 'information_requested',
          information_request: { message: 'Could you describe a recent piece of hadith research?', requested_at: '2026-10-03T09:30:00Z', deadline: '2026-10-10T09:30:00Z' },
          replies: [{ id: 1, message: 'I am comparing the chains of the wuḍūʾ reports.', created_at: '2026-10-03T18:02:00Z' }],
        }),
      ],
    })
    renderApp('/admin/applications?status=information_requested&application=417', { signedIn: true })
    const thread = await screen.findByRole('region', { name: 'Conversation with the applicant' })
    expect(within(thread).getByText('Could you describe a recent piece of hadith research?')).toBeInTheDocument()
    expect(within(thread).getByText('I am comparing the chains of the wuḍūʾ reports.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Shilan Rashid/ })).toHaveTextContent('Replied')
  })

  it('shows a decided application as it was decided, with no way to decide it again', async () => {
    admin()
    mockAdmin({ applications: [application({ status: 'approved', decision_reason: 'Verified academic credentials.', decided_by: 1, decided_at: '2026-10-04T11:02:00Z' })] })
    renderApp('/admin/applications?status=approved&application=417', { signedIn: true })
    const decision = await screen.findByRole('region', { name: 'Decision' })
    expect(decision).toHaveTextContent('Decided by ACC-0001')
    expect(within(decision).getByText('Verified academic credentials.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Decline with reason' })).not.toBeInTheDocument()
  })

  it('says the queue is empty, and how many people are still waiting on email verification', async () => {
    admin()
    mockAdmin({ applications: [], users: [adminUser({ status: 'unverified' }), adminUser({ id: 8, status: 'unverified' }), adminUser({ id: 9, status: 'unverified' })] })
    renderApp('/admin/applications', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'The queue is empty' })).toBeInTheDocument()
    expect(await screen.findByText('3 people are waiting on email verification.')).toBeInTheDocument()
  })

  it('says a decision was not recorded, without the server’s words', async () => {
    admin()
    mockAdmin({ decideApplication: () => HttpResponse.json({ success: false, error: { message: 'SQLSTATE boom' } }, { status: 500 }) })
    renderApp('/admin/applications?application=417', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Approve' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("The decision wasn't recorded")
    expect(screen.queryByText(/SQLSTATE/)).not.toBeInTheDocument()
  })

  it('does not call a decision recorded when the server answered 200 but kept the old state', async () => {
    admin()
    mockAdmin({ decideApplication: () => HttpResponse.json({ success: true, data: application(), meta: {} }) })
    renderApp('/admin/applications?application=417', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Approve' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("The server accepted the request but did not keep your decision")
    expect(screen.queryByText(/Decision recorded/)).not.toBeInTheDocument()
  })
})

describe('Accounts and roles', () => {
  const me = adminUser({ id: 1, display_name: 'Shilan Rashid', roles: ['admin', 'researcher'], is_admin: true })

  it('lists accounts with their code, email, highest role, state and sign-in step, and marks the person’s own', async () => {
    admin()
    mockAdmin({ users: [me, adminUser(), adminUser({ id: 98, display_name: 'Rebwar Omer', status: 'suspended', mfa: 'none', roles: ['researcher'] })] })
    renderApp('/admin/accounts', { signedIn: true })
    const row = (await screen.findByRole('row', { name: /Hêro Salih/ })).closest('tr')!
    expect(row).toHaveTextContent('ACC-0007')
    expect(row).toHaveTextContent('hero@example.org')
    expect(within(row).getByText('Corpus editor')).toBeInTheDocument()
    expect(within(row).getByText('Active')).toBeInTheDocument()
    expect(within(row).getByText('On')).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /Rebwar Omer/ })).toHaveTextContent('Suspended')
    expect(screen.getByRole('row', { name: /Shilan Rashid/ })).toHaveTextContent('(you)')
  })

  it('does not let an administrator change their own role or suspend themselves, and says why', async () => {
    admin()
    mockAdmin({ users: [me] })
    renderApp('/admin/accounts', { signedIn: true })
    const own = await screen.findByRole('button', { name: 'Change role Shilan Rashid' })
    expect(own).toBeDisabled()
    expect(own).toHaveAttribute('title', "You can't change your own role")
    expect(screen.queryByRole('button', { name: /Suspend/ })).not.toBeInTheDocument()
  })

  it('searches by name or email and filters by state, keeping both in the address', async () => {
    admin()
    const { calls } = mockAdmin({ users: [adminUser(), adminUser({ id: 98, display_name: 'Rebwar Omer', status: 'suspended' })] })
    const { router } = renderApp('/admin/accounts', { signedIn: true })
    await screen.findByRole('row', { name: /Hêro Salih/ })
    await userEvent.type(screen.getByLabelText('Search by name or email'), 'rebwar{Enter}')
    await waitFor(() => expect(router.state.location.search).toBe('?q=rebwar'))
    await waitFor(() => expect(calls.userQueries.at(-1)?.get('q')).toBe('rebwar'))
    expect(await screen.findByRole('row', { name: /Rebwar Omer/ })).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /Hêro Salih/ })).not.toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('State'), 'suspended')
    await waitFor(() => expect(calls.userQueries.at(-1)?.get('status')).toBe('suspended'))
  })

  it('changes roles, naming what the Administrator role gives, and records it', async () => {
    admin()
    const { calls } = mockAdmin({ users: [me, adminUser()] })
    renderApp('/admin/accounts', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Change role Hêro Salih' }))
    const dialog = await screen.findByRole('dialog', { name: 'Roles for Hêro Salih' })
    expect(within(dialog).getByRole('checkbox', { name: 'Researcher' })).toBeChecked()
    expect(within(dialog).getByRole('checkbox', { name: 'Corpus editor' })).toBeChecked()
    expect(within(dialog).getByRole('checkbox', { name: 'Administrator' })).not.toBeChecked()
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled()
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Administrator' }))
    expect(within(dialog).getByRole('note')).toHaveTextContent('gives access to everything in this area')
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Corpus editor' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(calls.roles).toEqual([{ id: '7', body: { roles: ['researcher', 'admin'] } }]))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('needs at least one role', async () => {
    admin()
    mockAdmin({ users: [adminUser({ roles: ['researcher'] })] })
    renderApp('/admin/accounts', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Change role Hêro Salih' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Researcher' }))
    expect(within(dialog).getByText('An account needs at least one role.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('suspends with a reason, which the server records, and offers to reactivate afterwards', async () => {
    admin()
    const { calls } = mockAdmin({ users: [me, adminUser()] })
    renderApp('/admin/accounts', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Suspend… Hêro Salih' }))
    const dialog = await screen.findByRole('dialog', { name: 'Suspend Hêro Salih?' })
    expect(within(dialog).getByText(/A suspended account can't sign in/)).toBeInTheDocument()
    const confirm = within(dialog).getByRole('button', { name: 'Suspend account' })
    expect(confirm).toBeDisabled()
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Violation of the code of conduct')
    await userEvent.click(confirm)
    await waitFor(() => expect(calls.statuses).toEqual([{ id: '7', body: { status: 'suspended', reason: 'Violation of the code of conduct' } }]))
    expect(await screen.findByRole('button', { name: 'Reactivate… Hêro Salih' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Suspend… Hêro Salih' })).not.toBeInTheDocument()
  })

  it('reactivates with a reason', async () => {
    admin()
    const { calls } = mockAdmin({ users: [adminUser({ status: 'suspended' })] })
    renderApp('/admin/accounts', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Reactivate… Hêro Salih' }))
    const dialog = await screen.findByRole('dialog', { name: 'Reactivate Hêro Salih?' })
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Appeal accepted')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reactivate account' }))
    await waitFor(() => expect(calls.statuses).toEqual([{ id: '7', body: { status: 'approved', reason: 'Appeal accepted' } }]))
  })

  it('says a suspension failed, and does not call it done when the server kept the old state', async () => {
    admin()
    mockAdmin({ users: [adminUser()], patchStatus: () => HttpResponse.json({ success: true, data: adminUser(), meta: {} }) })
    renderApp('/admin/accounts', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Suspend… Hêro Salih' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText(/Reason/), 'Because')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Suspend account' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent("The account wasn't suspended")
  })

  it('says plainly that these actions do not ask for a second step yet, and that there are no closure requests', async () => {
    admin()
    mockAdmin()
    renderApp('/admin/accounts', { signedIn: true })
    expect(await screen.findByText(/doesn't ask for a second authentication step yet/)).toBeInTheDocument()
    expect(await screen.findByText('No closure requests.')).toBeInTheDocument()
  })

  it('reviews a closure request and records the decision', async () => {
    admin()
    const { calls } = mockAdmin({ closures: [{ id: 63, display_name: 'Dara Hama', email: 'dara@example.org', closure_requested_at: '2026-10-05T10:00:00Z', closure_reason: 'I am leaving research.' }] })
    renderApp('/admin/accounts', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Review closure Dara Hama' }))
    const dialog = await screen.findByRole('dialog', { name: 'Closure request from Dara Hama' })
    expect(within(dialog).getByText('I am leaving research.')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Decline closure' }))
    await waitFor(() => expect(calls.closureDecisions).toEqual([{ id: '63', body: { decision: 'rejected' } }]))
  })
})

describe('Corpus corrections', () => {
  it('shows what is proposed against what is there, with the evidence and who proposed it', async () => {
    admin()
    mockAdmin()
    renderApp('/admin/proposals', { signedIn: true })
    const card = await screen.findByRole('article', { name: 'REP-000088' })
    expect(within(card).getByText('Unknown (not recorded)')).toBeInTheDocument()
    expect(within(card).getByText('p. 64')).toBeInTheDocument()
    expect(within(card).getByText('The printed edition shows this on page 64.')).toBeInTheDocument()
    expect(within(card).getByText('Shilan Rashid')).toBeInTheDocument()
    expect(screen.getByText(/It doesn't change the corpus itself yet/)).toBeInTheDocument()
  })

  it('accepts after confirmation, and the proposal leaves the waiting list', async () => {
    admin()
    const { calls } = mockAdmin()
    renderApp('/admin/proposals', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Accept COR-0038' }))
    const dialog = await screen.findByRole('dialog', { name: 'Accept COR-0038?' })
    expect(within(dialog).getByText(/The corpus is not changed/)).toBeInTheDocument()
    expect(calls.proposalDecisions).toEqual([])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Accept proposal' }))
    await waitFor(() => expect(calls.proposalDecisions).toEqual([{ id: '38', body: { status: 'accepted' } }]))
    expect(await screen.findByText('Decision recorded: accepted.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('article', { name: 'REP-000088' })).not.toBeInTheDocument())
  })

  it('rejects, and shows decided proposals read-only under their own state', async () => {
    admin()
    const { calls } = mockAdmin({ proposals: [proposal(), proposal({ id: 39, status: 'accepted', decided_at: '2026-10-05T12:00:00Z', decider: { id: 1, display_name: 'Karwan Aziz' } })] })
    const { router } = renderApp('/admin/proposals', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Reject COR-0038' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reject proposal' }))
    await waitFor(() => expect(calls.proposalDecisions).toEqual([{ id: '38', body: { status: 'rejected' } }]))
    await userEvent.click(screen.getByRole('button', { name: /Accepted/ }))
    await waitFor(() => expect(router.state.location.search).toBe('?status=accepted'))
    const card = await screen.findByRole('article', { name: 'REP-000088' })
    expect(card).toHaveTextContent('Karwan Aziz')
    expect(within(card).queryByRole('button')).not.toBeInTheDocument()
  })

  it('says a decision was not recorded when the server answered 200 but kept the old state', async () => {
    admin()
    mockAdmin({ decideProposal: () => HttpResponse.json({ success: true, data: proposal(), meta: {} }) })
    renderApp('/admin/proposals', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Accept COR-0038' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Accept proposal' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("The decision wasn't recorded")
  })
})

describe('Limits, quotas and jobs', () => {
  it('shows the limits the server reports, says they are not applied yet, and offers no way to change them', async () => {
    admin()
    mockAdmin()
    renderApp('/admin/limits', { signedIn: true })
    expect(await screen.findByText(/The server doesn't apply them yet/)).toBeInTheDocument()
    expect((await screen.findByText('Applications per email per day')).nextElementSibling).toHaveTextContent('1')
    expect(screen.getByText('Download storage per researcher').nextElementSibling).toHaveTextContent('5 GB')
    expect(screen.getByText('Result set size').nextElementSibling).toHaveTextContent('5,000 members')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Save|Edit|Change/ })).not.toBeInTheDocument()
  })

  it('shows a limit the server reports that the screen does not know, rather than hiding it', async () => {
    admin()
    mockAdmin({ limits: { concurrent_export_jobs: 2, brand_new_limit: 9 } })
    renderApp('/admin/limits', { signedIn: true })
    expect(await screen.findByText('brand_new_limit')).toBeInTheDocument()
  })

  it('lists export jobs by state, with why a failed one failed, and offers no retry', async () => {
    admin()
    const { calls } = mockAdmin({ jobs: [job(), job({ id: 61, status: 'completed', failure_reason: null, progress: 'Packaging completed' })] })
    const { router } = renderApp('/admin/limits', { signedIn: true })
    expect(await screen.findByText('EXP-0060')).toBeInTheDocument()
    expect(screen.getByText('EXP-0061')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Retry|Requeue/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Failed' }))
    await waitFor(() => expect(router.state.location.search).toBe('?jobs=failed'))
    await waitFor(() => expect(calls.jobQueries.at(-1)?.get('status')).toBe('failed'))
    expect(await screen.findByText('Storage timeout after 3 attempts')).toBeInTheDocument()
    expect(screen.queryByText('EXP-0061')).not.toBeInTheDocument()
  })
})

describe('Support access', () => {
  const NOW = '2026-10-06T10:00:00Z'
  it('lists grants with who gave them, why, and whether they are active', async () => {
    admin()
    mockAdmin({
      grants: [
        grant({ expires_at: new Date(Date.now() + 22 * 3_600_000).toISOString(), created_at: NOW }),
        grant({ id: 13, scope: 'document', object_id: 91, expires_at: '2026-10-02T10:00:00Z', reason: 'Ticket #298: PDF rendering of Sorani text' }),
      ],
    })
    renderApp('/admin/support', { signedIn: true })
    const active = (await screen.findByRole('row', { name: /PRJ-0015/ })).closest('tr')!
    expect(active).toHaveTextContent('Shilan Rashid to Karwan Aziz')
    expect(active).toHaveTextContent('Ticket #311')
    expect(within(active).getByText(/Active · 2\d h left/)).toBeInTheDocument()
    const expired = screen.getByRole('row', { name: /Document 91/ })
    expect(within(expired).getByText('Expired')).toBeInTheDocument()
    expect(within(expired).queryByRole('button')).not.toBeInTheDocument()
  })

  it('gives access back only when it is active and was given to the person, after confirmation', async () => {
    admin()
    const { calls } = mockAdmin({ grants: [grant({ admin_id: 1, expires_at: new Date(Date.now() + 5 * 3_600_000).toISOString() })] })
    renderApp('/admin/support', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Give back PRJ-0015' }))
    const dialog = await screen.findByRole('dialog', { name: 'Give back access to PRJ-0015?' })
    expect(calls.revoked).toEqual([])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Give back access' }))
    await waitFor(() => expect(calls.revoked).toEqual(['12']))
    expect(await screen.findByRole('heading', { name: 'No support grants' })).toBeInTheDocument()
  })

  it('offers no way to give back a grant made to another administrator', async () => {
    admin()
    mockAdmin({ grants: [grant({ admin_id: 2, expires_at: new Date(Date.now() + 5 * 3_600_000).toISOString() })] })
    renderApp('/admin/support', { signedIn: true })
    await screen.findByRole('row', { name: /PRJ-0015/ })
    expect(screen.queryByRole('button', { name: /Give back/ })).not.toBeInTheDocument()
  })

  it('explains how access is given and that private content stays private', async () => {
    admin()
    mockAdmin()
    renderApp('/admin/support', { signedIn: true })
    expect(await screen.findByText(/A researcher gives an administrator read-only access/)).toBeInTheDocument()
    expect(screen.getByText(/never shows private evidence, notes or documents/)).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'No support grants' })).toBeInTheDocument()
  })
})

describe('Audit log', () => {
  it('lists entries with code, time, actor, a plain action and the object, and never an outcome', async () => {
    admin()
    mockAdmin({ audit: [auditEntry(), auditEntry({ id: 88420, action: 'update_own_role_refused', object_type: 'user', object_id: 7, details: {} }), auditEntry({ id: 88421, action: 'assign_reviewer', object_type: 'submission', object_id: 184, details: [] })] })
    renderApp('/admin/audit', { signedIn: true })
    const row = (await screen.findByRole('row', { name: /AUD-88412/ })).closest('tr')!
    expect(row).toHaveTextContent('Karwan Aziz')
    expect(row).toHaveTextContent('ACC-0001')
    expect(row).toHaveTextContent('Decided an application')
    expect(row).toHaveTextContent('APP-0409')
    expect(screen.getByRole('row', { name: /AUD-88420/ })).toHaveTextContent('Tried to change their own role')
    expect(screen.getByRole('row', { name: /AUD-88421/ })).toHaveTextContent('SUB-0184')
    expect(screen.queryByText(/Success|Refused/)).not.toBeInTheDocument()
    expect(screen.getByText(/doesn't record whether an action succeeded/)).toBeInTheDocument()
  })

  it('shows the details of an entry exactly as recorded, and none when there are none', async () => {
    admin()
    mockAdmin({ audit: [auditEntry(), auditEntry({ id: 88420, details: [] })] })
    renderApp('/admin/audit', { signedIn: true })
    const row = (await screen.findByRole('row', { name: /AUD-88412/ })).closest('tr')!
    await userEvent.click(within(row).getByText('Details as recorded'))
    expect(within(row).getByText('Verified academic credentials.')).toBeInTheDocument()
    expect(within(row).getByText('decision')).toBeInTheDocument()
    expect(within(screen.getByRole('row', { name: /AUD-88420/ })).queryByText('Details as recorded')).not.toBeInTheDocument()
  })

  it('shows an action it has no wording for as it is, and filters by the ones it has', async () => {
    admin()
    const { calls } = mockAdmin({ audit: [auditEntry({ action: 'some_new_action' }), auditEntry({ id: 2, action: 'update_user_roles', object_type: 'user', object_id: 5 })] })
    const { router } = renderApp('/admin/audit', { signedIn: true })
    expect(await screen.findByText('some_new_action')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Action'), 'update_user_roles')
    await waitFor(() => expect(router.state.location.search).toBe('?action=update_user_roles'))
    await waitFor(() => expect(calls.auditQueries.at(-1)?.get('action')).toBe('update_user_roles'))
    await waitFor(() => expect(screen.queryByText('some_new_action')).not.toBeInTheDocument())
  })

  it('filters by object type, actor and time, and says when nothing matches', async () => {
    admin()
    const { calls } = mockAdmin({ audit: [auditEntry()] })
    renderApp('/admin/audit', { signedIn: true })
    await screen.findByRole('row', { name: /AUD-88412/ })
    await userEvent.selectOptions(screen.getByLabelText('Object type'), 'user')
    await userEvent.type(screen.getByLabelText('Actor (account number)'), '9')
    await userEvent.selectOptions(screen.getByLabelText('Time'), 'week')
    await waitFor(() => {
      const last = calls.auditQueries.at(-1)!
      expect(last.get('object_type')).toBe('user')
      expect(last.get('actor_id')).toBe('9')
      expect(Date.parse(last.get('from')!)).toBeLessThan(Date.now() - 6 * 24 * 3_600_000)
    })
    expect(await screen.findByRole('heading', { name: 'No entry matches' })).toBeInTheDocument()
    expect(screen.getByText(/never the text of private research/)).toBeInTheDocument()
  })

  it('pages through the entries', async () => {
    admin()
    const { calls } = mockAdmin({ audit: Array.from({ length: 120 }, (_, i) => auditEntry({ id: 1000 - i })) })
    renderApp('/admin/audit', { signedIn: true })
    await screen.findByRole('row', { name: /AUD-01000/ })
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(calls.auditQueries.at(-1)?.get('page')).toBe('2'))
    expect(await screen.findByRole('row', { name: /AUD-00950/ })).toBeInTheDocument()
  })

  it('says it could not load, with a retry', async () => {
    admin()
    mockAdmin({ list: (path) => (path === 'audit' ? HttpResponse.json({ success: false, error: { message: 'boom' } }, { status: 500 }) : undefined) })
    renderApp('/admin/audit', { signedIn: true })
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

describe('Operations', () => {
  it('shows the queue, failures and storage the server reports, and the alerts it raises', async () => {
    admin()
    mockAdmin({
      ops: { queue_depth: 2, failures_count: 3, storage_used_bytes: 5 * 1024 ** 3, active_alerts: [{ severity: 'warning', message: '3 export job failure(s) require administrative review.' }] },
      jobs: [job(), job({ id: 44, scope: 'account', failure_reason: 'Archived project read failure' })],
    })
    renderApp('/admin/operations', { signedIn: true })
    const queue = (await screen.findByText('Export queue')).closest('li')!
    expect(queue).toHaveTextContent('2')
    const failures = screen.getByText('Failed jobs', { selector: 'span' }).closest('li')!
    expect(failures).toHaveTextContent('3')
    expect(failures).toHaveTextContent('Needs review')
    expect(screen.getByText('Export storage').closest('li')).toHaveTextContent('5 GB')
    expect(screen.getByRole('alert')).toHaveTextContent('3 export job failure(s) require administrative review.')
    expect(await screen.findByText('EXP-0060')).toBeInTheDocument()
    expect(screen.getByText(/Archived project read failure/)).toBeInTheDocument()
  })

  it('lists what the design shows and the server does not report, as not reported rather than as healthy', async () => {
    admin()
    mockAdmin()
    renderApp('/admin/operations', { signedIn: true })
    const missing = await screen.findByRole('region', { name: 'Not reported by the server yet' })
    for (const what of ['Indexing status', 'Export queue latency', 'Error rate', 'Last backup', 'Export completeness']) {
      expect(within(missing).getByText(what)).toBeInTheDocument()
    }
    expect(await screen.findByText('No active alerts.')).toBeInTheDocument()
    expect(screen.getByText('None failed')).toBeInTheDocument()
  })

  it('says when it was last updated', async () => {
    admin()
    mockAdmin()
    renderApp('/admin/operations', { signedIn: true })
    expect(await screen.findByText(/Last updated .* · refreshes every minute/)).toBeInTheDocument()
  })
})
