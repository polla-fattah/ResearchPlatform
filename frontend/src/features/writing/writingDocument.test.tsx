import { EditorView } from '@codemirror/view'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { mockMe, renderApp } from '@/test/helpers'
import { server } from '@/test/server'
import { documentItem, mockWriting, person, version } from '@/test/writingMocks'

const OPEN = '/projects/12/findings?doc=31'

/** The CodeMirror editor on screen, once it has been built. */
async function editor(): Promise<EditorView> {
  const el = await waitFor(() => {
    const found = document.querySelector('.cm-editor')
    if (!found) throw new Error('editor not ready')
    return found as HTMLElement
  })
  return EditorView.findFromDOM(el)!
}
const typeAtEnd = (view: EditorView, text: string) => act(() => view.dispatch({ changes: { from: view.state.doc.length, insert: text } }))
const textOf = (view: EditorView) => view.state.doc.toString()

describe('Document editor: opening', () => {
  it('opens the newest version with its preview, takes the edit lock, and shows only names (never e-mails or profiles)', async () => {
    mockMe()
    const { calls } = mockWriting()
    renderApp(OPEN, { signedIn: true })
    const view = await editor()
    expect(textOf(view)).toContain('أَنَّ النَّبِيَّ تَوَضَّأَ ثَلاَثًا')
    expect(await screen.findByRole('heading', { name: 'Chains of the wuḍūʾ reports' })).toBeInTheDocument()
    expect(await screen.findByText('Saved · v2')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Wuḍūʾ' })).toBeInTheDocument() // the preview
    await waitFor(() => expect(calls.locks).toBe(1))
    expect(document.body.textContent).not.toContain('shilan@example.org')
  })

  it('says a document that is not in this project is not available', async () => {
    mockMe()
    mockWriting()
    renderApp('/projects/12/findings?doc=999', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'Document not available' })).toBeInTheDocument()
    expect(screen.getByText(/A citation link from another project never opens content here/)).toBeInTheDocument()
  })

  it('brings back a draft written on top of the current version, and says so', async () => {
    mockMe()
    mockWriting({ draft: { draft_content: '# Wuḍūʾ\n\nmy unsaved draft', draft_base_version: 2, last_saved_at: '2026-10-06T09:00:00Z' } })
    renderApp(OPEN, { signedIn: true })
    expect(textOf(await editor())).toContain('my unsaved draft')
    expect(await screen.findByText(/Your unsaved text from .* was restored/)).toBeInTheDocument()
  })

  it('ignores a draft that sits on an older version, so newer work is not undone (C-18)', async () => {
    mockMe()
    mockWriting({ draft: { draft_content: 'stale draft', draft_base_version: 1, last_saved_at: '2026-10-01T09:00:00Z' } })
    renderApp(OPEN, { signedIn: true })
    const view = await editor()
    expect(textOf(view)).not.toContain('stale draft')
    expect(screen.queryByText(/was restored/)).not.toBeInTheDocument()
  })

  it('is read-only for a viewer: no lock, no save, no citation button', async () => {
    mockMe()
    const { calls } = mockWriting({ role: 'viewer' })
    renderApp(OPEN, { signedIn: true })
    await editor()
    expect(await screen.findByText(/can read this document but not change it/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save version' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Insert citation' })).toBeDisabled()
    expect(document.querySelector('.cm-content')).toHaveAttribute('contenteditable', 'false')
    expect(calls.locks).toBe(0)
  })

  it('is read-only while someone else holds the edit lock, and says who and until when', async () => {
    mockMe()
    mockWriting({
      lock: () =>
        HttpResponse.json(
          { success: false, error: { code: 'LOCKED', message: 'locked', details: { locked_by_name: 'Aras Kamal', expires_at: '2026-10-06T10:15:00Z' } } },
          { status: 423 },
        ),
    })
    renderApp(OPEN, { signedIn: true })
    await editor()
    expect(await screen.findByText(/Aras Kamal is editing this document until/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save version' })).not.toBeInTheDocument()
    expect(document.querySelector('.cm-content')).toHaveAttribute('contenteditable', 'false')
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument()
  })
})

describe('Document editor: saving', () => {
  it('autosaves a draft after a pause in typing, never as a version', async () => {
    mockMe()
    const { calls } = mockWriting()
    renderApp(OPEN, { signedIn: true })
    const view = await editor()
    await screen.findByText('Saved · v2')
    typeAtEnd(view, ' more')
    expect(await screen.findByText('Unsaved changes')).toBeInTheDocument()
    await waitFor(() => expect(calls.drafts).toHaveLength(1), { timeout: 5000 })
    expect(calls.drafts[0]).toMatchObject({ base_version: 2 })
    expect(String(calls.drafts[0]!.content)).toContain('more')
    expect(await screen.findByText(/Draft saved/)).toBeInTheDocument()
    expect(calls.versions).toHaveLength(0)
  }, 15000)

  it('saves a version on top of the version it was opened from, with what changed, and says so', async () => {
    mockMe()
    const { calls } = mockWriting()
    renderApp(OPEN, { signedIn: true })
    const view = await editor()
    await screen.findByText('Saved · v2')
    typeAtEnd(view, ' and more')
    await userEvent.type(screen.getByLabelText('What changed (optional)'), 'Added a sentence')
    await userEvent.click(screen.getByRole('button', { name: 'Save version' }))
    await waitFor(() => expect(calls.versions).toHaveLength(1))
    expect(calls.versions[0]).toMatchObject({ expected_version: 2, change_summary: 'Added a sentence' })
    expect(String(calls.versions[0]!.content)).toContain('and more')
    expect(await screen.findByText('Saved · v3')).toBeInTheDocument()
  })

  it('stores the citations the text makes, with the server’s formatted wording, one per way they are cited', async () => {
    mockMe()
    const { calls } = mockWriting()
    renderApp(OPEN, { signedIn: true })
    const view = await editor()
    typeAtEnd(view, '\n\nWording [@EV-0004 paraphrase] and [@EV-0004 exact].')
    await screen.findByText(/Sunan Abī Dāwūd, 106_, Vol\. 1, p\. 78 \(EV-4\)/)
    await userEvent.click(screen.getByRole('button', { name: 'Save version' }))
    await waitFor(() => expect(calls.versions).toHaveLength(1))
    const citations = calls.versions[0]!.citations as Record<string, unknown>[]
    expect(citations.map((c) => c.citation_type).sort()).toEqual(['direct_quotation', 'paraphrase'])
    expect(citations[0]).toMatchObject({ evidence_id: 4, resource_id: 74, locator: 'Vol. 1, p. 78' })
    expect(String(citations[0]!.formatted_citation)).toContain('Sunan Abī Dāwūd')
  })

  it('keeps the text and offers a retry when the connection drops, storing it in this browser meanwhile', async () => {
    mockMe()
    let first = true
    mockWriting({
      putDraft: () => {
        if (first) {
          first = false
          return HttpResponse.error()
        }
        return undefined
      },
    })
    renderApp(OPEN, { signedIn: true })
    const view = await editor()
    typeAtEnd(view, ' typed offline')
    expect(await screen.findByText("Not saved. You're offline.", { selector: '[data-status]' }, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByText(/kept as a local draft in this browser/)).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('oh.draft.12.31')!)).toMatchObject({ baseVersion: 2 })
    expect(textOf(view)).toContain('typed offline')
    await userEvent.click(screen.getByRole('button', { name: 'Retry now' }))
    expect(await screen.findByText(/Draft saved/)).toBeInTheDocument()
    expect(localStorage.getItem('oh.draft.12.31')).toBeNull()
  }, 15000)

  it('opens with text that was kept offline and sends it again', async () => {
    mockMe()
    localStorage.setItem('oh.draft.12.31', JSON.stringify({ text: 'kept while offline', baseVersion: 2, at: 1_700_000_000_000 }))
    const { calls } = mockWriting()
    renderApp(OPEN, { signedIn: true })
    expect(textOf(await editor())).toBe('kept while offline')
    await waitFor(() => expect(calls.drafts).toHaveLength(1), { timeout: 5000 })
  }, 15000)

  it('shows the server’s refusal message for any other failure, not raw text', async () => {
    mockMe()
    mockWriting({ postVersion: () => HttpResponse.json({ success: false, error: { message: 'SQLSTATE boom' } }, { status: 500 }) })
    renderApp(OPEN, { signedIn: true })
    const view = await editor()
    typeAtEnd(view, ' x')
    await userEvent.click(screen.getByRole('button', { name: 'Save version' }))
    expect(await screen.findByText("The draft couldn't be saved")).toBeInTheDocument()
    expect(screen.queryByText(/SQLSTATE/)).not.toBeInTheDocument()
  })
})

describe('Document editor: a refused save (conflict)', () => {
  async function conflicted() {
    mockMe()
    const mocks = mockWriting()
    renderApp(OPEN, { signedIn: true })
    const view = await editor()
    await screen.findByText('Saved · v2')
    // Someone else saves v3 while this tab is still on v2.
    mocks.versions.push(version(3, '# Wuḍūʾ\n\ntheir newer text', { author: person({ id: 2, display_name: 'Aras Kamal' }) }))
    typeAtEnd(view, ' my text')
    await userEvent.click(screen.getByRole('button', { name: 'Save version' }))
    const dialog = await screen.findByRole('dialog', { name: 'Save stopped · conflict' })
    return { ...mocks, view, dialog }
  }

  it('shows both texts and who saved the newer version, and saves nothing', async () => {
    const { dialog, calls } = await conflicted()
    expect(within(dialog).getByText('Aras Kamal changed this document while you were editing')).toBeInTheDocument()
    expect(within(dialog).getByText(/their newer text/)).toBeInTheDocument()
    expect(within(dialog).getAllByText(/my text/).length).toBeGreaterThan(0)
    expect(calls.versions).toHaveLength(1)
    expect(await screen.findByText('Save stopped · conflict', { selector: '[data-status]' })).toBeInTheDocument()
  })

  it('"Open v3" shows their text and keeps mine beside it, so nothing is lost', async () => {
    const { dialog, view } = await conflicted()
    await userEvent.click(within(dialog).getByRole('button', { name: /Open v3 and keep my text beside it/ }))
    await waitFor(() => expect(textOf(view)).toBe('# Wuḍūʾ\n\ntheir newer text'))
    const shelved = await screen.findByRole('complementary', { name: 'Your earlier text' })
    expect(within(shelved).getByText(/my text/)).toBeInTheDocument()
    await userEvent.click(within(shelved).getByRole('button', { name: 'Add to the end of the document' }))
    await waitFor(() => expect(textOf(view)).toContain('my text'))
    expect(screen.queryByRole('complementary', { name: 'Your earlier text' })).not.toBeInTheDocument()
  })

  it('"Save mine as v4" puts my text on top of theirs, based on their version', async () => {
    const { dialog, calls } = await conflicted()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save mine as v4' }))
    await waitFor(() => expect(calls.versions).toHaveLength(2))
    expect(calls.versions[1]).toMatchObject({ expected_version: 3 })
    expect(String(calls.versions[1]!.content)).toContain('my text')
    expect(await screen.findByText('Saved · v4')).toBeInTheDocument()
  })

  it('"Decide later" closes the dialog and keeps my text', async () => {
    const { dialog, view } = await conflicted()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Decide later' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Save stopped · conflict' })).not.toBeInTheDocument())
    expect(textOf(view)).toContain('my text')
  })
})

describe('Document editor: citations', () => {
  it('inserts an exact quotation of the evidence, unchanged, and numbers it in the preview and the list', async () => {
    mockMe()
    mockWriting()
    renderApp(OPEN, { signedIn: true })
    const view = await editor()
    await userEvent.click(screen.getByRole('button', { name: 'Insert citation' }))
    const dialog = await screen.findByRole('dialog', { name: 'Insert citation' })
    await userEvent.selectOptions(within(dialog).getByLabelText('Evidence'), '4')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Insert' }))
    expect(textOf(view)).toContain('> «تَوَضَّأَ ثَلاَثًا ثَلاَثًا» [@EV-0004 exact]')
    expect(await screen.findByText('[1]', { selector: 'sup' })).toBeInTheDocument()
    expect(await screen.findByText(/Sunan Abī Dāwūd, 106_, Vol\. 1, p\. 78/)).toBeInTheDocument()
  })

  it('flags evidence that has no locator, and still lets it be inserted', async () => {
    mockMe()
    mockWriting()
    renderApp(OPEN, { signedIn: true })
    const view = await editor()
    await userEvent.click(screen.getByRole('button', { name: 'Insert citation' }))
    const dialog = await screen.findByRole('dialog', { name: 'Insert citation' })
    await userEvent.selectOptions(within(dialog).getByLabelText('Evidence'), '7')
    expect(within(dialog).getByText(/locator missing/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('radio', { name: /Paraphrase/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Insert with flag' }))
    expect(textOf(view)).toContain('[@EV-0007 paraphrase]')
    expect(await screen.findByText('Incomplete citation · locator missing')).toBeInTheDocument()
  })

  it('does not repeat the server’s author and year flags, which are wrong while the author is known (C-18)', async () => {
    mockMe()
    mockWriting()
    renderApp(OPEN, { signedIn: true })
    const view = await editor()
    typeAtEnd(view, '\n\n[@EV-0004]')
    await screen.findByText(/Sunan Abī Dāwūd, 106_/)
    expect(screen.queryByText(/author|year/i, { selector: 'li *' })).not.toBeInTheDocument()
  })

  it('says when the text cites evidence that is not in this project', async () => {
    mockMe()
    mockWriting()
    renderApp(OPEN, { signedIn: true })
    const view = await editor()
    typeAtEnd(view, '\n\nUnknown [@EV-0999].')
    expect(await screen.findByText('EV-0999 is not evidence in this project.')).toBeInTheDocument()
  })

  it('says there is nothing to cite in a project without evidence', async () => {
    mockMe()
    mockWriting({ evidence: [] })
    renderApp(OPEN, { signedIn: true })
    await editor()
    await userEvent.click(screen.getByRole('button', { name: 'Insert citation' }))
    expect(await screen.findByText('This project has no evidence to cite yet.')).toBeInTheDocument()
  })
})

describe('Document editor: preview', () => {
  it('shows each block in its own direction and never renders raw HTML typed into the text', async () => {
    mockMe()
    mockWriting()
    renderApp(OPEN, { signedIn: true })
    const view = await editor()
    typeAtEnd(view, '\n\n<img src=x onerror=alert(1)> and <script>alert(1)</script>')
    await waitFor(() => expect(document.querySelector('[class*="preview"] p[dir="auto"]')).toBeTruthy())
    expect(document.querySelector('[class*="preview"] img')).toBeNull()
    expect(document.querySelector('[class*="preview"] script')).toBeNull()
  })
})

describe('Document editor: versions', () => {
  it('lists every version with its author, shows the text of an old one, and compares it with the newest', async () => {
    mockMe()
    mockWriting()
    renderApp(OPEN, { signedIn: true })
    await editor()
    await userEvent.click(screen.getByRole('button', { name: 'Versions' }))
    expect(await screen.findByRole('heading', { name: 'Version history' })).toBeInTheDocument()
    const rows = await screen.findAllByRole('button', { name: /^v\d · Shilan Rashid/ })
    expect(rows).toHaveLength(2)
    await userEvent.click(rows[1]!) // v1
    expect(await screen.findByRole('heading', { name: 'Version 1' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Compare with current' }))
    expect(await screen.findByText('Comparing v1 → v2 (current)')).toBeInTheDocument()
    const diff = screen.getByRole('list', { name: 'Comparing v1 → v2 (current)' })
    expect(within(diff).getByText('first')).toBeInTheDocument()
    expect(within(diff).getAllByText('removed').length).toBeGreaterThan(0)
    expect(within(diff).getAllByText('added').length).toBeGreaterThan(0)
  })

  it('restores an old version as a new head version and shows its text in the editor', async () => {
    mockMe()
    const { calls } = mockWriting()
    renderApp(OPEN, { signedIn: true })
    const view = await editor()
    await userEvent.click(screen.getByRole('button', { name: 'Versions' }))
    const rows = await screen.findAllByRole('button', { name: /^v\d · Shilan Rashid/ })
    await userEvent.click(rows[1]!)
    await userEvent.click(await screen.findByRole('button', { name: 'Restore v1 as v3' }))
    await waitFor(() => expect(calls.restores).toEqual(['1']))
    await waitFor(() => expect(textOf(view)).toBe('# Wuḍūʾ\n\nfirst'))
    expect(await screen.findByText('Saved · v3')).toBeInTheDocument()
  })

  it('keeps unsaved text safe while the history is open', async () => {
    mockMe()
    mockWriting()
    renderApp(OPEN, { signedIn: true })
    const view = await editor()
    typeAtEnd(view, ' unsaved words')
    await userEvent.click(screen.getByRole('button', { name: 'Versions' }))
    await userEvent.click(await screen.findByRole('button', { name: /^← Back to Chains/ }))
    expect(textOf(view)).toContain('unsaved words')
  })

  it('offers no restore to a viewer', async () => {
    mockMe()
    mockWriting({ role: 'viewer' })
    renderApp(OPEN, { signedIn: true })
    await editor()
    await userEvent.click(screen.getByRole('button', { name: 'Versions' }))
    const rows = await screen.findAllByRole('button', { name: /^v\d · / })
    await userEvent.click(rows[1]!)
    await screen.findByRole('heading', { name: 'Version 1' })
    expect(screen.queryByRole('button', { name: /^Restore/ })).not.toBeInTheDocument()
  })
})

describe('Document editor: managing the document', () => {
  it('renames it', async () => {
    mockMe()
    const { calls } = mockWriting()
    renderApp(OPEN, { signedIn: true })
    await editor()
    await userEvent.click(screen.getByRole('button', { name: 'Rename' }))
    const dialog = await screen.findByRole('dialog', { name: 'Rename document' })
    const input = within(dialog).getByLabelText(/Title/)
    expect(input).toHaveValue('Chains of the wuḍūʾ reports')
    await userEvent.clear(input)
    await userEvent.type(input, 'New title')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(calls.patchedDocs).toEqual([{ title: 'New title' }]))
  })

  it('deletes it only after confirmation, and returns to the list', async () => {
    mockMe()
    const { calls } = mockWriting()
    renderApp(OPEN, { signedIn: true })
    await editor()
    await userEvent.click(screen.getByRole('button', { name: 'Delete document…' }))
    const dialog = await screen.findByRole('dialog')
    expect(calls.deletedDocs).toEqual([])
    expect(within(dialog).getByText(/every version of it are removed/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete document' }))
    await waitFor(() => expect(calls.deletedDocs).toEqual(['31']))
    expect(await screen.findByRole('heading', { name: 'Findings and documents' })).toBeInTheDocument()
  })

  it('links a finding to the document and unlinks it', async () => {
    mockMe()
    const { calls } = mockWriting({ documents: [documentItem({ findings: [{ id: 5, claim: 'A second claim', status: 'supported' }] })] })
    renderApp(OPEN, { signedIn: true })
    await editor()
    expect(await screen.findByText('A second claim')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Unlink F-05' }))
    await waitFor(() => expect(calls.docUnlinks).toEqual(['5']))
    await userEvent.click(screen.getByRole('button', { name: '+ Link finding' }))
    const dialog = await screen.findByRole('dialog', { name: 'Link a finding to this document' })
    await userEvent.selectOptions(await within(dialog).findByLabelText(/Finding/), '4')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Link' }))
    await waitFor(() => expect(calls.docLinks).toEqual(['4']))
  })

  it('says a failed rename did not happen', async () => {
    mockMe()
    mockWriting()
    server.use(http.patch('*/api/v1/projects/12/documents/:id', () => HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'The title is too long.' } }, { status: 422 })))
    renderApp(OPEN, { signedIn: true })
    await editor()
    await userEvent.click(screen.getByRole('button', { name: 'Rename' }))
    const dialog = await screen.findByRole('dialog', { name: 'Rename document' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/The title is too long\./)
  })
})
