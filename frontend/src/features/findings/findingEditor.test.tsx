import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { session } from '@/api/http'
import { envelope, mockMe, renderApp } from '@/test/helpers'
import { mockProjectApis, projectDetail } from '@/test/projectMocks'
import { server } from '@/test/server'

function setupFindingEditorMocks(role = 'owner') {
  session.set('test-token')
  mockMe()
  mockProjectApis(12, {
    detail: projectDetail({ id: 12, my_role: role }),
  })

  server.use(
    http.get('*/api/v1/projects/:id/documents', () => {
      return HttpResponse.json(
        envelope([
          {
            id: 1,
            project_id: 12,
            title: 'Main article',
            document_type: 'article',
            latest_version: {
              id: 15,
              document_id: 1,
              version_number: 15,
              content: 'Initial text',
              change_summary: 'Laptop session',
              author: { id: 1, display_name: 'Shilan Rashid' },
            },
          },
        ]),
      )
    }),
    http.get('*/api/v1/projects/:id/findings', () => {
      return HttpResponse.json(
        envelope([
          {
            id: 4,
            project_id: 12,
            question: 'Is al-Tirmidhī’s wording a later expansion?',
            claim: 'Probably yes.',
            reasoning: 'Detailed reasoning...',
            status: 'provisional',
            version: 1,
            evidence_items: [],
          },
        ]),
      )
    }),
  )
}

describe('Finding and document editor (Screen 11)', () => {
  it('renders review bar with WRT requirements and document editor by default', async () => {
    setupFindingEditorMocks()
    renderApp('/projects/12/findings')

    await waitFor(() => {
      expect(
        screen.getByText(/11 · Finding and document editor/i),
      ).toBeInTheDocument()
    })
    expect(
      screen.getByText(/WRT-01 · 02 · 03 · 04 · 05 · 06/i),
    ).toBeInTheDocument()
    expect(screen.getByText('Main article')).toBeInTheDocument()
    expect(screen.getByText(/Saved 11:42 · v15/i)).toBeInTheDocument()
  })

  it('allows toggling per-block text direction between LTR and RTL', async () => {
    setupFindingEditorMocks()
    const user = userEvent.setup()
    renderApp('/projects/12/findings')

    await waitFor(() => {
      expect(screen.getByText('Main article')).toBeInTheDocument()
    })

    // Find block direction buttons
    const dirButtons = screen.getAllByRole('button', { name: /Block direction/i })
    expect(dirButtons.length).toBeGreaterThan(0)

    const firstBtn = dirButtons[0]!
    expect(firstBtn).toHaveTextContent('LTR')

    // Click to cycle direction
    await user.click(firstBtn)
    expect(firstBtn).toHaveTextContent('RTL')

    // Click again to cycle back to LTR
    await user.click(firstBtn)
    expect(firstBtn).toHaveTextContent('LTR')
  })

  it('renders preview elements including Arabic blockquote and citation footnotes', async () => {
    setupFindingEditorMocks()
    renderApp('/projects/12/findings')

    await waitFor(() => {
      expect(screen.getByText('Main article')).toBeInTheDocument()
    })

    // Exact quotation preview
    expect(
      screen.getAllByText(/«أَنَّ النَّبِيَّ صلى الله عليه وسلم تَوَضَّأَ ثَلاَثًا ثَلاَثًا»/).length,
    ).toBeGreaterThan(0)

    // Citations footnotes section
    expect(screen.getByText('Citations')).toBeInTheDocument()
    expect(screen.getByText(/Abū Dāwūd, al-Sunan/i)).toBeInTheDocument()
    expect(screen.getByText('Incomplete citation · page')).toBeInTheDocument()
  })

  it('switches to Findings and documents index view and lists items', async () => {
    setupFindingEditorMocks()
    const user = userEvent.setup()
    renderApp('/projects/12/findings')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Findings & documents' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Findings & documents' }))

    // Index title and subtitle count
    expect(
      screen.getByRole('heading', { level: 1, name: 'Findings and documents' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/2 documents · 6 findings · 9 links between them/i),
    ).toBeInTheDocument()

    // Action buttons
    expect(screen.getByRole('button', { name: 'New finding' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New document' })).toBeInTheDocument()

    // Lists
    expect(screen.getByText('Documents · 2')).toBeInTheDocument()
    expect(screen.getByText('Chain summary')).toBeInTheDocument()
    expect(screen.getByText('Findings · 6')).toBeInTheDocument()
    expect(
      screen.getByText(/F-04 · Al-Tirmidhī’s wording is a later expansion/i),
    ).toBeInTheDocument()
  })

  it('switches to Finding view and displays structured fields and 4 evidence categories', async () => {
    setupFindingEditorMocks()
    const user = userEvent.setup()
    renderApp('/projects/12/findings')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Finding' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Finding' }))

    expect(screen.getByText(/F-04 · finding/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Question/i)).toHaveValue(
      'Is al-Tirmidhī’s “once, twice, three times” a later expansion of the Kufan wording?',
    )
    expect(screen.getByLabelText(/Claim or conclusion/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Reasoning/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Limitations/i)).toBeInTheDocument()

    // Evidence categories
    expect(screen.getByText(/Supporting · 3 evidence items/i)).toBeInTheDocument()
    expect(screen.getByText(/Opposing · 0 evidence items/i)).toBeInTheDocument()
    expect(screen.getByText(/Contextual · 1 evidence item/i)).toBeInTheDocument()
    expect(screen.getByText(/Unresolved · 1 evidence item/i)).toBeInTheDocument()

    // Contributors
    expect(screen.getByText('Shilan Rashid · author')).toBeInTheDocument()
  })

  it('validates WRT-01 submission readiness and warns on missing limitations', async () => {
    setupFindingEditorMocks()
    const user = userEvent.setup()
    renderApp('/projects/12/findings?view=finding')

    await waitFor(() => {
      expect(screen.getByText('Before public submission')).toBeInTheDocument()
    })

    // Initially F-04 has empty limitations, so it warns
    expect(
      screen.getByText(/fields are missing: Limitations/i),
    ).toBeInTheDocument()

    // Fill in limitations
    const limitationsInput = screen.getByLabelText(/Limitations/i)
    await user.type(limitationsInput, 'Limited by Kufan local isnad coverage')

    // Warning updates to ready notice
    expect(
      screen.getByText(/All required public-submission fields are present/i),
    ).toBeInTheDocument()
  })

  it('opens Citation Inserter modal, previews metadata, and inserts citation', async () => {
    setupFindingEditorMocks()
    const user = userEvent.setup()
    renderApp('/projects/12/findings')

    await waitFor(() => {
      expect(screen.getByText('Main article')).toBeInTheDocument()
    })

    const citeBtns = screen.getAllByRole('button', { name: 'Insert citation' })
    await user.click(citeBtns[citeBtns.length - 1]!)

    // Modal opens
    const dialog = screen.getByRole('dialog', { name: 'Insert citation' })
    expect(dialog).toBeInTheDocument()

    // Mode options
    expect(within(dialog).getByText('Exact quotation')).toBeInTheDocument()
    expect(within(dialog).getByText('Paraphrase')).toBeInTheDocument()

    // Metadata breakdown
    expect(within(dialog).getByText('al-Sunan (al-Nasāʾī)')).toBeInTheDocument()
    expect(within(dialog).getByText('Missing page')).toBeInTheDocument()
    expect(within(dialog).getByText('84 (al-Nasāʾī numbering)')).toBeInTheDocument()

    // Insert
    await user.click(within(dialog).getByRole('button', { name: 'Insert with flag' }))

    // Dialog closes
    expect(screen.queryByRole('dialog', { name: 'Insert citation' })).not.toBeInTheDocument()
  })

  it('opens Versions view, shows version comparison diff, and non-destructive restore', async () => {
    setupFindingEditorMocks()
    const user = userEvent.setup()
    renderApp('/projects/12/findings')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Versions' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Versions' }))

    // Versions view
    expect(screen.getByRole('heading', { level: 1, name: 'Version history' })).toBeInTheDocument()
    expect(screen.getByText('Comparing v12 → v15 (current)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restore v12 as v16' })).toBeInTheDocument()

    // Explanatory note
    expect(
      screen.getByText(/Restoring never deletes later history/i),
    ).toBeInTheDocument()

    // Restore v12
    await user.click(screen.getByRole('button', { name: 'Restore v12 as v16' }))

    // Navigates back to editor with new v16
    expect(screen.getByText(/v16/i)).toBeInTheDocument()
  })

  it('displays session and member conflict modals with side-by-side preservation (DEF-8 / COL-06)', async () => {
    setupFindingEditorMocks()
    const user = userEvent.setup()

    // Test session conflict state
    renderApp('/projects/12/findings?st=conflict')

    await waitFor(() => {
      expect(
        screen.getByRole('alertdialog', { name: 'This document changed in another session' }),
      ).toBeInTheDocument()
    })

    expect(screen.getByText(/Saved v15 · other session/i)).toBeInTheDocument()
    expect(screen.getByText(/Your unsaved text · this tab/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Save mine as v16' }),
    ).toBeInTheDocument()

    // Test member conflict view (COL-06)
    await user.click(screen.getByRole('button', { name: 'Member edit conflict' }))
    expect(
      screen.getByRole('alertdialog', {
        name: 'Aras Kamal changed this paragraph while you were editing',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/v16 · Aras Kamal/i)).toBeInTheDocument()
    expect(
      screen.getByText(/There['’]s no real-time co-editing in R1/i),
    ).toBeInTheDocument()
  })

  it('renders Forbidden state without revealing document existence (DEF-2)', async () => {
    setupFindingEditorMocks()
    renderApp('/projects/12/findings?st=forbidden')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: 'Document not available' }),
      ).toBeInTheDocument()
    })
    expect(
      screen.getByText(/doesn['’]t exist in this project, or you can['’]t open it/i),
    ).toBeInTheDocument()
  })
})
