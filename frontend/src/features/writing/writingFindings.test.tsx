import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { mockMe, renderApp } from '@/test/helpers'
import { server } from '@/test/server'
import { findingItem, mockWriting } from '@/test/writingMocks'

const INDEX = '/projects/12/findings'
const saveStatus = () => document.querySelector('span[role="status"]')

describe('Findings and documents: the index', () => {
  it('lists the documents and the findings side by side, by name and claim', async () => {
    mockMe()
    mockWriting()
    renderApp(INDEX, { signedIn: true })
    expect(await screen.findByRole('heading', { level: 1, name: 'Findings and documents' })).toBeInTheDocument()
    expect(await screen.findByText('Chains of the wuḍūʾ reports')).toBeInTheDocument()
    expect(screen.getByText('The three-times wording is the shortest form.')).toBeInTheDocument()
    expect(screen.getByText('A second claim')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Documents · 1' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Findings · 2' })).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('shilan@example.org')
  })

  it('explains what findings and documents are when there are none', async () => {
    mockMe()
    mockWriting({ documents: [], findings: [] })
    renderApp(INDEX, { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'Nothing written yet' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'New document' }).length).toBeGreaterThan(0)
  })

  it('says what failed and offers a retry, without the server’s wording', async () => {
    mockMe()
    mockWriting()
    server.use(http.get('*/api/v1/projects/12/documents', () => HttpResponse.json({ success: false, error: { message: 'SQLSTATE[HY000]' } }, { status: 500 })))
    renderApp(INDEX, { signedIn: true })
    expect(await screen.findByRole('heading', { name: "Findings and documents couldn't be loaded" })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.queryByText(/SQLSTATE/)).not.toBeInTheDocument()
  })

  it('offers no way to start anything to a viewer', async () => {
    mockMe()
    mockWriting({ role: 'viewer' })
    renderApp(INDEX, { signedIn: true })
    await screen.findByText('Chains of the wuḍūʾ reports')
    expect(screen.queryByRole('button', { name: 'New document' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New finding' })).not.toBeInTheDocument()
  })

  it('creates a document with its kind and language, and opens it', async () => {
    mockMe()
    const { calls } = mockWriting()
    renderApp(INDEX, { signedIn: true })
    await screen.findByText('Chains of the wuḍūʾ reports')
    await userEvent.click(screen.getByRole('button', { name: 'New document' }))
    const dialog = await screen.findByRole('dialog', { name: 'New document' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create document' }))
    expect(await within(dialog).findByText('This is needed before the finding can be saved.')).toBeInTheDocument()
    expect(calls.createdDocs).toHaveLength(0)
    await userEvent.type(within(dialog).getByLabelText(/Title/), 'My study')
    await userEvent.selectOptions(within(dialog).getByLabelText('Language'), 'ckb')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create document' }))
    await waitFor(() => expect(calls.createdDocs).toHaveLength(1))
    expect(calls.createdDocs[0]).toMatchObject({ title: 'My study', document_type: 'article', language: 'ckb', content: '# My study\n\n' })
  })

  it('opens a document and a finding from the list, and the address says where you are', async () => {
    mockMe()
    mockWriting()
    const { router } = renderApp(INDEX, { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: /A second claim/ }))
    expect(router.state.location.search).toBe('?finding=5')
    expect(await screen.findByRole('heading', { name: 'Used in documents' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '← Findings and documents' }))
    await userEvent.click(await screen.findByRole('button', { name: /Chains of the wuḍūʾ reports/ }))
    expect(router.state.location.search).toBe('?doc=31')
  })
})

describe('Finding', () => {
  it('shows the question, claim and reasoning, its evidence grouped by how it bears on the claim, and where it is used', async () => {
    mockMe()
    mockWriting()
    renderApp(`${INDEX}?finding=4`, { signedIn: true })
    expect(await screen.findByDisplayValue('The three-times wording is the shortest form.')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Do the Kufan chains share a common link?')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Supporting · 1' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Opposing · 1' })).toBeInTheDocument()
    expect(screen.getByText('Shortest form.')).toBeInTheDocument()
    const used = screen.getByRole('region', { name: 'Used in documents' })
    expect(within(used).getByRole('button', { name: 'Chains of the wuḍūʾ reports' })).toBeInTheDocument()
    expect(screen.getByText('Not recorded')).toBeInTheDocument() // contributors
  })

  it('offers the four statuses the server accepts, and says withdrawing is not available (C-18)', async () => {
    mockMe()
    mockWriting()
    renderApp(`${INDEX}?finding=4`, { signedIn: true })
    await screen.findByDisplayValue('The three-times wording is the shortest form.')
    const status = screen.getByRole('group', { name: 'Status' })
    expect(within(status).getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual(['provisional', 'supported', 'inconclusive', 'disputed'])
    expect(within(status).queryByRole('radio', { name: /Withdrawn/ })).not.toBeInTheDocument()
    expect(within(status).getByText("Withdrawing a finding isn't available yet.")).toBeInTheDocument()
  })

  it('saves what changed on top of the version it was opened from', async () => {
    mockMe()
    const { calls } = mockWriting()
    renderApp(`${INDEX}?finding=4`, { signedIn: true })
    const claim = await screen.findByLabelText(/Claim or conclusion/)
    expect(screen.getByRole('button', { name: 'Save finding' })).toBeDisabled()
    await userEvent.clear(claim)
    await userEvent.type(claim, 'A sharper claim')
    await userEvent.click(screen.getByRole('radio', { name: 'Supported' }))
    expect(saveStatus()).toHaveTextContent('Unsaved changes')
    await userEvent.click(screen.getByRole('button', { name: 'Save finding' }))
    await waitFor(() => expect(calls.patchedFindings).toHaveLength(1))
    expect(calls.patchedFindings[0]).toMatchObject({ claim: 'A sharper claim', status: 'supported', expected_version: 1 })
    await waitFor(() => expect(saveStatus()).toHaveTextContent('Saved'))
    expect(screen.getByRole('button', { name: 'Save finding' })).toBeDisabled()
  })

  it('does not call a change saved when the server answered 200 but kept the old value (C-18)', async () => {
    mockMe()
    mockWriting({ patchFinding: () => HttpResponse.json({ success: true, data: findingItem(), meta: {} }) })
    renderApp(`${INDEX}?finding=4`, { signedIn: true })
    const claim = await screen.findByLabelText(/Claim or conclusion/)
    await userEvent.clear(claim)
    await userEvent.type(claim, 'Will not stick')
    await userEvent.click(screen.getByRole('button', { name: 'Save finding' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("The finding wasn't saved")
    expect(saveStatus()).toHaveTextContent('Unsaved changes')
    expect(screen.getByLabelText(/Claim or conclusion/)).toHaveValue('Will not stick')
  })

  it('needs question, claim and reasoning before it will save', async () => {
    mockMe()
    const { calls } = mockWriting()
    renderApp(`${INDEX}?finding=4`, { signedIn: true })
    const reasoning = await screen.findByLabelText(/Reasoning/)
    await userEvent.clear(reasoning)
    await userEvent.click(screen.getByRole('button', { name: 'Save finding' }))
    expect(await screen.findByText('This is needed before the finding can be saved.')).toBeInTheDocument()
    expect(calls.patchedFindings).toHaveLength(0)
  })

  it('creates a new finding and moves to it', async () => {
    mockMe()
    const { calls } = mockWriting({ findings: [findingItem({ id: 9, claim: 'Brand new', evidence_items: [], documents: [] })] })
    const { router } = renderApp(`${INDEX}?finding=new`, { signedIn: true })
    await userEvent.type(await screen.findByLabelText(/Question/), 'Q?')
    await userEvent.type(screen.getByLabelText(/Claim or conclusion/), 'Brand new')
    await userEvent.type(screen.getByLabelText(/Reasoning/), 'Because.')
    await userEvent.click(screen.getByRole('button', { name: 'Create finding' }))
    await waitFor(() => expect(calls.createdFindings).toHaveLength(1))
    expect(calls.createdFindings[0]).toMatchObject({ question: 'Q?', claim: 'Brand new', reasoning: 'Because.', limitations: null, status: 'provisional' })
    await waitFor(() => expect(router.state.location.search).toBe('?finding=9'))
  })

  it('tells a viewer the finding is read-only and offers no edit controls', async () => {
    mockMe()
    mockWriting({ role: 'viewer' })
    renderApp(`${INDEX}?finding=4`, { signedIn: true })
    await screen.findByDisplayValue('The three-times wording is the shortest form.')
    expect(screen.getByText('Your role in this project can read findings but not change them.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Claim or conclusion/)).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save finding' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Link evidence' })).not.toBeInTheDocument()
  })

  it('lists what a public submission still needs, and updates it as limitations are typed', async () => {
    mockMe()
    mockWriting({ findings: [findingItem({ evidence_items: [findingItem().evidence_items[0]!] })] })
    renderApp(`${INDEX}?finding=4`, { signedIn: true })
    const note = await screen.findByRole('region', { name: 'Before public submission' })
    expect(note).toHaveTextContent('2 fields are missing')
    await userEvent.type(screen.getByLabelText(/Limitations/), 'Only Kufan chains.')
    expect(note).toHaveTextContent('1 field is missing')
  })

  it('links evidence that is not yet linked, with how it bears on the finding', async () => {
    mockMe()
    const { calls } = mockWriting({ findings: [findingItem({ evidence_items: [findingItem().evidence_items[0]!] })] })
    renderApp(`${INDEX}?finding=4`, { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: '+ Link evidence' }))
    const dialog = await screen.findByRole('dialog', { name: 'Link evidence to F-04' })
    const select = await within(dialog).findByLabelText(/^Evidence/)
    expect(within(select).queryByRole('option', { name: /EV-0004/ })).not.toBeInTheDocument() // already linked
    await userEvent.selectOptions(select, '7')
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Opposing' }))
    await userEvent.type(within(dialog).getByLabelText(/How it bears/), 'Once only')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Link' }))
    await waitFor(() => expect(calls.evidenceLinks).toHaveLength(1))
    expect(calls.evidenceLinks[0]).toMatchObject({ evidence_id: 7, relation_type: 'opposing', interpretation: 'Once only' })
  })

  it('unlinks evidence and says when that fails', async () => {
    mockMe()
    const { calls } = mockWriting()
    renderApp(`${INDEX}?finding=4`, { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Unlink EV-0004' }))
    await waitFor(() => expect(calls.evidenceUnlinks).toEqual(['4']))
    server.use(http.delete('*/api/v1/projects/12/findings/:id/evidence/:eid', () => HttpResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'no' } }, { status: 403 })))
    await userEvent.click(screen.getByRole('button', { name: 'Unlink EV-0007' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("The link wasn't changed")
  })

  it('deletes only after confirmation, says how many documents use it, and returns to the list', async () => {
    mockMe()
    const { calls } = mockWriting()
    renderApp(`${INDEX}?finding=4`, { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Delete finding…' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('It is used in 1 document.')).toBeInTheDocument()
    expect(calls.deletedFindings).toEqual([])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete finding' }))
    await waitFor(() => expect(calls.deletedFindings).toEqual(['4']))
    expect(await screen.findByRole('heading', { level: 1, name: 'Findings and documents' })).toBeInTheDocument()
  })

  it('offers the latest copy, never a silent merge, when someone else saved it meanwhile', async () => {
    mockMe()
    const { calls } = mockWriting({
      getFinding: (n) => (n >= 2 ? HttpResponse.json({ success: true, data: findingItem({ claim: 'Their claim', updated_at: '2026-10-06T08:00:00Z' }), meta: {} }) : undefined),
    })
    renderApp(`${INDEX}?finding=4`, { signedIn: true })
    const claim = await screen.findByLabelText(/Claim or conclusion/)
    await userEvent.type(claim, ' mine')
    // Any change elsewhere refetches the finding; linking evidence is one.
    await userEvent.click(screen.getByRole('button', { name: 'Unlink EV-0007' }))
    await waitFor(() => expect(calls.evidenceUnlinks).toEqual(['7']))
    expect(await screen.findByText('This finding changed in another session.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Claim or conclusion/)).toHaveValue('The three-times wording is the shortest form. mine')
    await userEvent.click(screen.getByRole('button', { name: 'Show the latest' }))
    expect(screen.getByLabelText(/Claim or conclusion/)).toHaveValue('Their claim')
    expect(screen.queryByText('This finding changed in another session.')).not.toBeInTheDocument()
  })

  it('says a finding from another project is not available', async () => {
    mockMe()
    mockWriting()
    renderApp(`${INDEX}?finding=999`, { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'Document not available' })).toBeInTheDocument()
  })
})
