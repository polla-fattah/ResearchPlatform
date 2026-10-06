import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { session } from '@/api/http'
import { envelope, mockMe, renderApp } from '@/test/helpers'
import { mockProjectApis, projectDetail } from '@/test/projectMocks'
import { server } from '@/test/server'

function setupComparisonMocks(role = 'owner') {
  session.set('test-token')
  mockMe()
  mockProjectApis(12, {
    detail: projectDetail({ id: 12, my_role: role }),
  })

  // Mock analysis list and save endpoints
  server.use(
    http.get('*/api/v1/projects/:id/analyses', () => {
      return HttpResponse.json(
        envelope([
          {
            id: 3,
            project_id: 12,
            analysis_type: 'matn_comparison',
            input_params: { hadith_ids: [1, 2, 3] },
            output_data: {},
            version_number: 2,
            created_by: 1,
            created_at: '2026-09-25T14:10:00Z',
            creator: { id: 1, display_name: 'Shilan Rashid' },
          },
        ]),
      )
    }),
    http.post('*/api/v1/projects/:id/analyses/save', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      return HttpResponse.json(
        envelope(
          {
            id: 4,
            project_id: 12,
            analysis_type: body.analysis_type,
            input_params: body.input_params,
            output_data: body.output_data,
            version_number: 3,
            created_by: 1,
            created_at: '2026-10-06T12:00:00Z',
            creator: { id: 1, display_name: 'Shilan Rashid' },
          }),
          { status: 201 },
        )
      },
    ),
  )
}

describe('Comparison workspace (Screen 10)', () => {
  it('renders side-by-side occurrences with source headers and wording', async () => {
    setupComparisonMocks()
    renderApp('/projects/12/analysis', { signedIn: true })

    // Expect Occurrences tab to be active
    const occTab = await screen.findByRole('tab', { name: /Occurrences/i })
    expect(occTab).toHaveAttribute('aria-selected', 'true')

    // Saved analysis header
    expect(screen.getByText('Kufan chains side by side')).toBeInTheDocument()
    expect(screen.getByText('AN-0003 · v2')).toBeInTheDocument()

    // Occurrence columns
    expect(screen.getByText(/Sunan Abī Dāwūd · 106/i)).toBeInTheDocument()
    expect(screen.getByText(/Sunan al-Tirmidhī · 44/i)).toBeInTheDocument()
    expect(screen.getByText(/Sunan al-Nasāʾī · 84/i)).toBeInTheDocument()

    // Diff toggle checkbox and legend
    expect(screen.getByLabelText(/Highlight differences/i)).toBeChecked()
    expect(screen.getByText(/Wording only in some occurrences/i)).toBeInTheDocument()
    expect(screen.getByText(/Has an annotation/i)).toBeInTheDocument()

    // Horizontal scroll region
    expect(
      screen.getByRole('region', { name: /Side-by-side occurrences, scrolls horizontally/i }),
    ).toBeInTheDocument()
  })

  it('toggles difference highlighting on and off', async () => {
    const user = userEvent.setup()
    setupComparisonMocks()
    renderApp('/projects/12/analysis', { signedIn: true })

    const diffCheckbox = await screen.findByLabelText(/Highlight differences/i)
    expect(diffCheckbox).toBeChecked()

    await user.click(diffCheckbox)
    expect(diffCheckbox).not.toBeChecked()

    await user.click(diffCheckbox)
    expect(diffCheckbox).toBeChecked()
  })

  it('switches between Occurrences, Chains, Dossier, and Criticism modes', async () => {
    const user = userEvent.setup()
    setupComparisonMocks()
    renderApp('/projects/12/analysis', { signedIn: true })

    // 1. Switch to Chains
    const chainsTab = await screen.findByRole('tab', { name: /Chains/i })
    await user.click(chainsTab)
    expect(chainsTab).toHaveAttribute('aria-selected', 'true')

    // Chains header & items
    expect(screen.getByText(/3 chains, from the compiler/i)).toBeInTheDocument()
    expect(screen.getByText(/Abū Dāwūd 106/i)).toBeInTheDocument()
    expect(screen.getByText(/al-Tirmidhī 44/i)).toBeInTheDocument()
    expect(screen.getByText(/al-Nasāʾī 84/i)).toBeInTheDocument()

    // Inspector panel with default ambiguity selection
    expect(screen.getByRole('complementary', { name: /Inspector/i })).toBeInTheDocument()
    expect(screen.getByText(/Ambiguity record AMB-0091/i)).toBeInTheDocument()
    expect(screen.getByText(/Sufyān al-Thawrī/i)).toBeInTheDocument()
    expect(screen.getByText(/Sufyān ibn ʿUyayna/i)).toBeInTheDocument()

    // Inspect regular narrator
    const musaddadBtn = screen.getByRole('button', { name: /Musaddad/i })
    await user.click(musaddadBtn)

    const inspector = screen.getByRole('complementary', { name: /Inspector/i })
    expect(within(inspector).getByText('Musaddad')).toBeInTheDocument()
    const openDossierBtn = within(inspector).getByRole('button', { name: /Open narrator dossier/i })

    // 2. Click Open narrator dossier -> switches to dossier view
    await user.click(openDossierBtn)
    expect(await screen.findByRole('tab', { name: /Narrator dossier/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByText(/Narrator dossier · NAR-000512/i)).toBeInTheDocument()
    expect(screen.getByText(/Teachers and students/i)).toBeInTheDocument()
    expect(screen.getByText(/Attributed criticism/i)).toBeInTheDocument()

    // 3. Click Compare criticism -> switches to Criticism view
    const compareCritBtn = screen.getByRole('button', { name: /Compare criticism →/i })
    await user.click(compareCritBtn)
    expect(await screen.findByRole('tab', { name: /Criticism/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    // Criticism matrix table
    expect(screen.getByText(/Each critic's exact wording is kept/i)).toBeInTheDocument()
    const critTable = screen.getByRole('region', { name: /Criticism comparison table/i })
    expect(critTable).toBeInTheDocument()
    expect(within(critTable).getAllByText('Ibn Ḥajar')[0]).toBeInTheDocument()
    expect(within(critTable).getByText('al-ʿIjlī')).toBeInTheDocument()
  })

  it('reruns the analysis and increments the version number', async () => {
    const user = userEvent.setup()
    setupComparisonMocks()
    renderApp('/projects/12/analysis', { signedIn: true })

    const rerunBtn = await screen.findByRole('button', { name: /Rerun as v3/i })
    await user.click(rerunBtn)

    // Version updated
    expect(screen.getByText('AN-0003 · v3')).toBeInTheDocument()
    expect(screen.getByText(/Rerun completed as v3/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Rerun as v4/i })).toBeInTheDocument()
  })

  it('saves analysis and confirms with toast notice', async () => {
    const user = userEvent.setup()
    setupComparisonMocks()
    renderApp('/projects/12/analysis', { signedIn: true })

    const saveBtn = await screen.findByRole('button', { name: /Save analysis/i })
    await user.click(saveBtn)

    expect(await screen.findByText(/Analysis AN-0003 · v2 saved/i)).toBeInTheDocument()
  })

  it('renders limitation notice in error state when occurrence wording is missing', async () => {
    setupComparisonMocks()
    renderApp('/projects/12/analysis?st=error', { signedIn: true })

    expect(await screen.findByText(/Limitation notice/i)).toBeInTheDocument()
    expect(
      screen.getByText(
        /The corpus has no occurrence-specific wording for this occurrence yet/i,
      ),
    ).toBeInTheDocument()
  })

  it('renders honest forbidden state without disclosing private existence', async () => {
    setupComparisonMocks()
    renderApp('/projects/12/analysis?st=forbidden', { signedIn: true })

    expect(await screen.findByText(/Analysis not available/i)).toBeInTheDocument()
    expect(
      screen.getByText(
        /This analysis doesn't exist in this project, or one of its inputs belongs to a project you can't open/i,
      ),
    ).toBeInTheDocument()
  })

  it('renders empty state with appropriate guidance per view', async () => {
    const user = userEvent.setup()
    setupComparisonMocks()
    renderApp('/projects/12/analysis?st=empty', { signedIn: true })

    // Empty state on occurrences
    expect(await screen.findByText(/Select occurrences to compare/i)).toBeInTheDocument()
    expect(screen.getByText(/Untitled analysis/i)).toBeInTheDocument()
    expect(screen.getByText(/not saved/i)).toBeInTheDocument()

    // Switch to chains
    const chainsTab = screen.getByRole('tab', { name: /Chains/i })
    await user.click(chainsTab)
    expect(screen.getByText(/Select chains to compare/i)).toBeInTheDocument()

    // Switch to criticism
    const critTab = screen.getByRole('tab', { name: /Criticism/i })
    await user.click(critTab)
    expect(screen.getByText(/Choose a narrator/i)).toBeInTheDocument()

    // Has links to pick from evidence
    expect(screen.getAllByRole('link', { name: /Pick from evidence/i })[0]).toHaveAttribute(
      'href',
      '/projects/12/evidence',
    )
  })

  it('renders pulsing skeleton in loading state', async () => {
    setupComparisonMocks()
    renderApp('/projects/12/analysis?st=loading', { signedIn: true })

    await screen.findByRole('region', { name: /Saved analysis/i })
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument()
  })

  it('allows adding an annotation note to an occurrence', async () => {
    const user = userEvent.setup()
    setupComparisonMocks()
    renderApp('/projects/12/analysis', { signedIn: true })

    const annotateBtns = await screen.findAllByRole('button', { name: /\+ Annotate difference/i })
    await user.click(annotateBtns[0]!)

    // Modal opens
    const textarea = screen.getByPlaceholderText(/Add your note on this variant/i)
    await user.type(textarea, 'Special vocalization observed in Kufan transmission')

    const saveNoteBtn = screen.getByRole('button', { name: /Save note/i })
    await user.click(saveNoteBtn)

    // Note added to occurrence notes list
    await waitFor(() => {
      expect(
        screen.getByText('Special vocalization observed in Kufan transmission'),
      ).toBeInTheDocument()
    })
  })
})
