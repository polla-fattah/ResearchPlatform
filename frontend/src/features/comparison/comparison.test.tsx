import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { criticismResult, isnadResult, mockComparison, report, runItem, type ComparisonApis, type Statement } from '@/test/comparisonMocks'
import { mockMe, renderApp } from '@/test/helpers'
import { server } from '@/test/server'

const N = (id: number, name: string) => ({ id, name })
const BUKHARI = report(101, {
  matn: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ',
  book: 'Sahih al-Bukhari',
  number: 1,
  extraPlaces: 2,
  chains: [{ id: 1001, narrators: [N(1, 'Al-Humaydi'), N(2, 'Sufyan'), N(3, 'Yahya'), N(4, 'Alqamah'), N(5, 'Umar')] }],
})
const MUSLIM = report(102, {
  matn: 'الأَعْمَالُ بِالنِّيَّةِ',
  book: 'Sahih Muslim',
  number: 1907,
  chains: [{ id: 1002, narrators: [N(6, 'Qutaybah'), N(2, 'Sufyan'), N(3, 'Yahya'), N(4, 'Alqamah'), N(5, 'Umar')] }],
})
const NASAI = report(103, {
  matn: '',
  book: 'Sunan al-Nasaʾi',
  number: 84,
  chains: [{ id: 1003, narrators: [N(7, 'Hannad'), N(3, 'Yahya'), N(5, 'Umar')] }],
})
const critic = (id: number, name: string, deathdate?: string) => ({ id, name, deathdate })
const statement = (id: number, c: ReturnType<typeof critic>, qawl: string): Statement => ({ id, critic: c, qawl })

const base = (over: ComparisonApis = {}): ComparisonApis => ({
  reports: [BUKHARI, MUSLIM, NASAI],
  evidence: [
    { id: 4, hadithId: 101, annotations: [{ id: 1, author_id: 1, annotation_kind: 'interpretation', visibility: 'project_shared', body: 'Plural form.', author: { id: 2, display_name: 'Aras Kamal' } }] },
    { id: 7, hadithId: 102 },
  ],
  narrators: [N(1, 'Al-Humaydi'), N(2, 'Sufyan'), N(3, 'Yahya'), N(4, 'Alqamah'), N(5, 'Umar'), N(6, 'Qutaybah'), N(7, 'Hannad')],
  statements: {
    3: [statement(31, critic(80, 'Ibn Maʿīn', '233'), 'ثقة'), statement(32, critic(81, 'al-ʿIjlī', '261'), 'كوفي ثقة'), statement(33, critic(82, 'Abū Ḥātim'), 'صدوق')],
    5: [statement(51, critic(80, 'Ibn Maʿīn', '233'), 'إمام')],
  },
  ...over,
})

const selectInputs = async () => userEvent.click((await screen.findAllByRole('button', { name: 'Select inputs…' }))[0]!)
const OCC = '/projects/12/analysis?view=occ&h=101,102'
const CHAINS = '/projects/12/analysis?view=chains&h=101,102'

describe('Comparison workspace: the start', () => {
  it('says what to do first, offers the stored analyses, and shows nothing invented', async () => {
    mockMe()
    mockComparison(base({ runs: [runItem()] }))
    renderApp('/projects/12/analysis', { signedIn: true })
    expect(await screen.findByRole('heading', { level: 1, name: 'Untitled analysis' })).toBeInTheDocument()
    expect(screen.getByText('No inputs yet')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Select occurrences to compare' })).toBeInTheDocument()
    expect(await screen.findByRole('option', { name: 'Saved analyses · 1' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Occurrences', 'Chains', 'Narrator dossier', 'Criticism'])
  })

  it('has an empty state for each view, and the address says which view it is', async () => {
    mockMe()
    mockComparison(base())
    const { router } = renderApp('/projects/12/analysis', { signedIn: true })
    await userEvent.click(await screen.findByRole('tab', { name: 'Chains' }))
    expect(await screen.findByRole('heading', { name: 'Select chains to compare' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?view=chains')
    await userEvent.click(screen.getByRole('tab', { name: 'Criticism' }))
    expect(await screen.findByRole('heading', { name: 'Choose a narrator' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Criticism' })).toHaveAttribute('aria-selected', 'true')
  })
})

describe('Comparison workspace: choosing inputs', () => {
  it('lists the corpus reports the project holds as evidence, needs two, and puts the choice in the address', async () => {
    mockMe()
    mockComparison(base())
    const { router } = renderApp('/projects/12/analysis', { signedIn: true })
    await selectInputs()
    const dialog = await screen.findByRole('dialog', { name: 'Select inputs' })
    const apply = within(dialog).getByRole('button', { name: 'Use these' })
    expect(apply).toBeDisabled()
    await userEvent.click(await within(dialog).findByRole('checkbox', { name: /REP-000101/ }))
    expect(apply).toBeDisabled()
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /REP-000102/ }))
    expect(within(dialog).getByRole('status')).toHaveTextContent('2 of 6 chosen')
    await userEvent.click(apply)
    await waitFor(() => expect(router.state.location.search).toBe('?h=101%2C102'))
    expect(await screen.findByRole('heading', { name: 'Sahih al-Bukhari · 1' })).toBeInTheDocument()
  })

  it('finds a report in the corpus when the project does not hold it as evidence', async () => {
    mockMe()
    const { calls } = mockComparison(base({ evidence: [], searchHits: [{ id: 103, matn: 'نص', book: 'Sunan al-Nasaʾi' }, { id: 101, matn: 'نص آخر', book: 'Sahih al-Bukhari' }] }))
    renderApp('/projects/12/analysis', { signedIn: true })
    await selectInputs()
    const dialog = await screen.findByRole('dialog', { name: 'Select inputs' })
    expect(within(dialog).getByText('This project has no evidence from the corpus yet.')).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText('Search the corpus for a report'), 'الأعمال')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Search' }))
    await userEvent.click(await within(dialog).findByRole('checkbox', { name: /REP-000103/ }))
    expect(calls.searches).toEqual(['الأعمال'])
  })

  it('stops at six reports', async () => {
    mockMe()
    const many = [101, 102, 103, 104, 105, 106, 107].map((id) => report(id, { book: `B${id}` }))
    mockComparison(base({ reports: many, evidence: many.map((r, i) => ({ id: i + 1, hadithId: r.id })) }))
    renderApp('/projects/12/analysis', { signedIn: true })
    await selectInputs()
    const dialog = await screen.findByRole('dialog', { name: 'Select inputs' })
    for (const id of [101, 102, 103, 104, 105, 106]) await userEvent.click(await within(dialog).findByRole('checkbox', { name: new RegExp(`REP-000${id}`) }))
    expect(within(dialog).getByRole('checkbox', { name: /REP-000107/ })).toBeDisabled()
    expect(within(dialog).getByRole('status')).toHaveTextContent('6 of 6 chosen')
  })
})

describe('Occurrences', () => {
  it('shows each report in its original wording under its source, with the codes the design uses', async () => {
    mockMe()
    mockComparison(base())
    renderApp(OCC, { signedIn: true })
    const bukhari = await screen.findByRole('article', { name: 'Sahih al-Bukhari · 1' })
    expect(bukhari.querySelector('p[dir="rtl"]')).toHaveTextContent('إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ')
    expect(bukhari.querySelector('header')).toHaveTextContent('REP-000101 · EV-0004 · 2 other places')
    expect(screen.getByRole('article', { name: 'Sahih Muslim · 1907' }).querySelector('p[dir="rtl"]')).toHaveTextContent('الأَعْمَالُ بِالنِّيَّةِ')
    expect(screen.getByText('2 reports, compared on original wording')).toBeInTheDocument()
  })

  it('marks only the words that some of the texts lack, and the original letters stay as they are', async () => {
    mockMe()
    mockComparison(base())
    renderApp(OCC, { signedIn: true })
    const bukhari = await screen.findByRole('article', { name: 'Sahih al-Bukhari · 1' })
    const marked = Array.from(bukhari.querySelectorAll('[class*="wordSome"]')).map((e) => e.textContent)
    expect(marked).toEqual(['إِنَّمَا', 'بِالنِّيَّاتِ'])
    expect(bukhari.querySelector('p[dir="rtl"]')?.textContent).toBe('إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Highlight differences' }))
    expect(bukhari.querySelectorAll('[class*="wordSome"]')).toHaveLength(0)
    expect(bukhari.querySelector('p[dir="rtl"]')).toHaveTextContent('إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ')
  })

  it('says what was counted, and that it compares words rather than their order', async () => {
    mockMe()
    mockComparison(base())
    renderApp(OCC, { signedIn: true })
    const summary = await screen.findByRole('region', { name: 'What the comparison counted' })
    expect(summary).toHaveTextContent('1 word is in every text.')
    expect(summary).toHaveTextContent("can't tell a change of order")
    expect(within(summary).getAllByText('100%')).toHaveLength(2)
    expect(within(await screen.findByRole('article', { name: 'Sahih al-Bukhari · 1' })).getByText('Baseline')).toBeInTheDocument()
  })

  it('compares with another report when asked, and keeps that in the address', async () => {
    mockMe()
    const { calls } = mockComparison(base())
    const { router } = renderApp(OCC, { signedIn: true })
    const muslim = await screen.findByRole('article', { name: 'Sahih Muslim · 1907' })
    await userEvent.click(within(muslim).getByRole('button', { name: 'Use as baseline' }))
    await waitFor(() => expect(router.state.location.search).toContain('base=102'))
    await waitFor(() => expect(calls.matn.at(-1)).toMatchObject({ hadith_ids: [101, 102], baseline_id: 102 }))
    expect(within(await screen.findByRole('article', { name: 'Sahih Muslim · 1907' })).getByText('Baseline')).toBeInTheDocument()
  })

  it('gives a limitation notice, not an invented text, for a report with no wording', async () => {
    mockMe()
    mockComparison(base())
    renderApp('/projects/12/analysis?view=occ&h=101,102,103', { signedIn: true })
    const nasai = await screen.findByRole('article', { name: 'Sunan al-Nasaʾi · 84' })
    expect(within(nasai).getByRole('note')).toHaveTextContent('The corpus has no wording for this report yet. No variants are shown, because they would have to be invented.')
    expect(nasai.querySelector('[class*="wording"]')).toBeNull()
  })

  it('leaves out a report the corpus does not have, and says so', async () => {
    mockMe()
    mockComparison(base())
    renderApp('/projects/12/analysis?view=occ&h=101,102,999', { signedIn: true })
    expect(await screen.findByText("REP-000999 isn't in the corpus, so it is left out.")).toBeInTheDocument()
    expect(await screen.findByText('2 reports, compared on original wording')).toBeInTheDocument()
  })

  it('needs two reports that exist', async () => {
    mockMe()
    mockComparison(base())
    renderApp('/projects/12/analysis?view=occ&h=101,999', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'Two reports are needed' })).toBeInTheDocument()
  })

  it('shows the project’s notes under the text they are about, with who wrote them and who can see them', async () => {
    mockMe()
    mockComparison(base())
    renderApp(OCC, { signedIn: true })
    const bukhari = await screen.findByRole('article', { name: 'Sahih al-Bukhari · 1' })
    expect(await within(bukhari).findByText(/Aras Kamal: Plural form\./)).toBeInTheDocument()
    expect(within(bukhari).getByText('Project')).toBeInTheDocument()
    expect(within(screen.getByRole('article', { name: 'Sahih Muslim · 1907' })).getByText('No notes yet.')).toBeInTheDocument()
  })

  it('adds a note through the evidence item that holds the text', async () => {
    mockMe()
    const { calls } = mockComparison(base())
    renderApp(OCC, { signedIn: true })
    const muslim = await screen.findByRole('article', { name: 'Sahih Muslim · 1907' })
    await userEvent.click(await within(muslim).findByRole('button', { name: '+ Annotate' }))
    const dialog = await screen.findByRole('dialog', { name: 'Note on Sahih Muslim · 1907' })
    await userEvent.type(within(dialog).getByLabelText(/Annotation/), 'Singular form')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(calls.annotations).toEqual([{ evidenceId: 7, annotation_kind: 'interpretation', body: 'Singular form', visibility: 'private' }]))
    expect(await within(await screen.findByRole('article', { name: 'Sahih Muslim · 1907' })).findByText(/Singular form/)).toBeInTheDocument()
  })

  it('says a report that is not evidence yet cannot carry a note, and offers no note to a viewer', async () => {
    mockMe()
    mockComparison(base({ evidence: [{ id: 4, hadithId: 101 }], role: 'viewer' }))
    renderApp(OCC, { signedIn: true })
    const muslim = await screen.findByRole('article', { name: 'Sahih Muslim · 1907' })
    expect(within(muslim).getByText(/isn't evidence in the project yet/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Annotate' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save analysis' })).not.toBeInTheDocument()
  })

  it('says the comparison failed without showing what the server said', async () => {
    mockMe()
    mockComparison(base({ matn: () => HttpResponse.json({ success: false, error: { message: 'SQLSTATE boom' } }, { status: 500 }) }))
    renderApp(OCC, { signedIn: true })
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText(/SQLSTATE/)).not.toBeInTheDocument()
  })

  it('stores the comparison as a new version on request, and offers to open it', async () => {
    mockMe()
    const { calls } = mockComparison(base({ runs: [runItem()] }))
    renderApp(OCC, { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Save analysis' }))
    await waitFor(() => expect(calls.matn.at(-1)).toMatchObject({ hadith_ids: [101, 102], save_run: true }))
    const done = await screen.findByText(/Saved as Occurrence comparison · v2/)
    expect(done).toHaveTextContent('(AN-0101)')
    expect(within(done).getByRole('link', { name: 'Open it' })).toHaveAttribute('href', '/projects/12/analysis?run=101')
  })
})

describe('Chains', () => {
  it('shows the chains side by side from the compiler to the earliest source, and marks narrators who are in every chain', async () => {
    mockMe()
    mockComparison(base())
    renderApp(CHAINS, { signedIn: true })
    const first = await screen.findByRole('region', { name: 'Sahih al-Bukhari · 1' })
    const names = within(first).getAllByRole('button').map((b) => b.textContent)
    expect(names[0]).toContain('Al-Humaydi')
    expect(names[4]).toContain('Umar')
    expect(within(first).getByRole('button', { name: /Umar/ })).toHaveTextContent('In every chain')
    expect(within(first).getByRole('button', { name: /Al-Humaydi/ })).not.toHaveTextContent('In every chain')
    expect(screen.getByText('The chains first differ at position 1.')).toBeInTheDocument()
    expect(screen.getByText(/2 chains, from the narrator nearest the compiler/)).toBeInTheDocument()
  })

  it('says what this comparison does not report, instead of implying nothing is uncertain', async () => {
    mockMe()
    mockComparison(base())
    renderApp(CHAINS, { signedIn: true })
    expect(await screen.findByText(/doesn't report uncertain order, narrators whose name is not recorded, or names that fit more than one person/)).toBeInTheDocument()
  })

  it('marks narrators in some of the chains with how many, and inspects a narrator on selection', async () => {
    mockMe()
    mockComparison(base())
    renderApp('/projects/12/analysis?view=chains&h=101,102,103', { signedIn: true })
    const first = await screen.findByRole('region', { name: 'Sahih al-Bukhari · 1' })
    expect(within(first).getByRole('button', { name: /Sufyan/ })).toHaveTextContent('In 2 of 3 chains')
    await userEvent.click(within(first).getByRole('button', { name: /Sufyan/ }))
    const inspector = screen.getByRole('complementary', { name: 'Inspector' })
    expect(within(inspector).getByText('NAR-000002')).toBeInTheDocument()
    expect(within(inspector).getByText('Appears in 2 of 3 chains compared here')).toBeInTheDocument()
    expect(within(inspector).getByText('Unknown')).toBeInTheDocument()
  })

  it('opens the narrator’s dossier from the inspector', async () => {
    mockMe()
    mockComparison(base())
    const { router } = renderApp(CHAINS, { signedIn: true })
    await userEvent.click((await screen.findAllByRole('button', { name: /Yahya/ }))[0]!)
    await userEvent.click(screen.getByRole('button', { name: 'Open narrator dossier' }))
    await waitFor(() => expect(router.state.location.search).toContain('view=dossier'))
    expect(router.state.location.search).toContain('narrator=3')
    expect(await screen.findByRole('heading', { name: 'Yahya' })).toBeInTheDocument()
  })

  it('needs two chains', async () => {
    mockMe()
    mockComparison(base())
    renderApp('/projects/12/analysis?view=chains&h=101', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'Two chains are needed' })).toBeInTheDocument()
    expect(screen.getByText('These reports have 1 chain. Pick reports with at least two.')).toBeInTheDocument()
  })

  it('stores the chains compared, by their chain ids', async () => {
    mockMe()
    const { calls } = mockComparison(base())
    renderApp(CHAINS, { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Save analysis' }))
    await waitFor(() => expect(calls.isnad.at(-1)).toEqual({ sanad_ids: [1001, 1002], save_run: true }))
    expect(await screen.findByText(/Saved as Chain comparison · v1/)).toBeInTheDocument()
  })
})

describe('Narrator dossier', () => {
  it('asks which narrator when none is chosen, and opens the one picked', async () => {
    mockMe()
    const { calls } = mockComparison(base())
    const { router } = renderApp('/projects/12/analysis?view=dossier', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'Choose a narrator' })).toBeInTheDocument()
    await userEvent.type(screen.getByRole('textbox', { name: 'Find a narrator by name' }), 'Yah')
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    await userEvent.click(await screen.findByRole('button', { name: /Yahya/ }))
    expect(calls.narratorSearches).toEqual(['Yah'])
    await waitFor(() => expect(router.state.location.search).toBe('?view=dossier&narrator=3'))
  })

  it('shows the record as the corpus has it, and what the corpus leaves out as Unknown, never as a blank', async () => {
    mockMe()
    mockComparison(base({ narrators: [N(1, 'Al-Humaydi'), N(2, 'Sufyan'), { id: 3, name: 'Yahya', kunya: 'Abū Saʿīd', rutba_description: 'ثقة ثبت', deathdate: '143' } as never, N(4, 'Alqamah'), N(5, 'Umar'), N(6, 'Qutaybah'), N(7, 'Hannad')] }))
    renderApp('/projects/12/analysis?view=dossier&narrator=3', { signedIn: true })
    const identity = await screen.findByRole('region', { name: 'Identity' })
    const facts = within(identity)
    expect(facts.getByText('Abū Saʿīd')).toBeInTheDocument()
    expect(facts.getByText('ثقة ثبت')).toBeInTheDocument()
    expect(facts.getByText('143')).toBeInTheDocument()
    expect(identity.querySelectorAll('[class*="neutral"]').length).toBeGreaterThanOrEqual(5)
    expect(screen.getByText('Narrator dossier · NAR-000003')).toBeInTheDocument()
    expect(screen.getByText('A dossier is read from the corpus and isn’t stored.')).toBeInTheDocument()
  })

  it('lists teachers and students, and statements with their exact wording and who made them', async () => {
    mockMe()
    mockComparison(base())
    renderApp('/projects/12/analysis?view=dossier&narrator=3', { signedIn: true })
    const links = await screen.findByRole('region', { name: 'Teachers and students' })
    expect(await within(links).findByText(/Teacher One/)).toBeInTheDocument()
    expect(within(links).getByText('Teachers · 2 recorded')).toBeInTheDocument()
    expect(within(links).getByText('Students · 1 recorded')).toBeInTheDocument()
    const criticism = screen.getByRole('region', { name: 'Attributed criticism' })
    expect(await within(criticism).findByText('كوفي ثقة')).toBeInTheDocument()
    expect(within(criticism).getByText(/Attributed to Ibn Maʿīn/)).toBeInTheDocument()
  })

  it('says in how many of the compared chains the narrator stands', async () => {
    mockMe()
    mockComparison(base())
    renderApp('/projects/12/analysis?view=dossier&narrator=6&h=101,102', { signedIn: true })
    expect(await screen.findByText('Appears in 1 of 2 chains compared here')).toBeInTheDocument()
  })

  it('goes on to compare criticism for the narrator', async () => {
    mockMe()
    mockComparison(base())
    const { router } = renderApp('/projects/12/analysis?view=dossier&narrator=3', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Compare criticism →' }))
    await waitFor(() => expect(router.state.location.search).toContain('view=crit'))
    expect(router.state.location.search).toContain('n=3')
  })

  it('says a narrator the corpus does not have is not available', async () => {
    mockMe()
    mockComparison(base())
    renderApp('/projects/12/analysis?view=dossier&narrator=999', { signedIn: true })
    expect(await screen.findByRole('heading', { name: "That page isn't available" })).toBeInTheDocument()
  })
})

describe('Criticism', () => {
  it('shows who said something about whom, and each statement in the critic’s exact words, with what is missing marked as such', async () => {
    mockMe()
    const { calls } = mockComparison(base())
    renderApp('/projects/12/analysis?view=crit&n=3,5', { signedIn: true })
    const matrix = await screen.findByRole('table', { name: /Who said something about whom/ })
    expect(within(matrix).getAllByText('Statement recorded').length).toBe(4)
    expect(within(matrix).getByRole('row', { name: /Abū Ḥātim/ })).toHaveTextContent('—')
    expect(within(matrix).getByRole('row', { name: /Statements recorded/ })).toHaveTextContent('31')
    const yahya = await screen.findByRole('region', { name: 'Statements about Yahya' })
    expect(within(yahya).getByText('ثقة')).toBeInTheDocument()
    expect(within(yahya).getByText('كوفي ثقة')).toBeInTheDocument()
    expect(within(yahya).getAllByText('No source recorded')).toHaveLength(3)
    expect(within(yahya).getAllByText('Not provided')).toHaveLength(3)
    expect(within(yahya).getByText(/d\. 233/)).toBeInTheDocument()
    expect(calls.criticism.at(-1)).toEqual({ narrator_ids: [3, 5] })
  })

  it('pages through a narrator’s statements', async () => {
    mockMe()
    const { calls } = mockComparison(base({ pageSize: 2 }))
    renderApp('/projects/12/analysis?view=crit&n=3', { signedIn: true })
    const yahya = await screen.findByRole('region', { name: 'Statements about Yahya' })
    expect(await within(yahya).findByText('كوفي ثقة')).toBeInTheDocument()
    expect(within(yahya).queryByText('صدوق')).not.toBeInTheDocument()
    await userEvent.click(within(yahya).getByRole('button', { name: 'Next' }))
    expect(await within(yahya).findByText('صدوق')).toBeInTheDocument()
    expect(calls.criticismPages).toContain(2)
  })

  it('adds and removes narrators, and keeps them in the address', async () => {
    mockMe()
    const { calls } = mockComparison(base())
    const { router } = renderApp('/projects/12/analysis?view=crit&n=3', { signedIn: true })
    await screen.findByRole('region', { name: 'Statements about Yahya' })
    await userEvent.type(screen.getByRole('textbox', { name: 'Find a narrator by name' }), 'Umar')
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    await userEvent.click(await screen.findByRole('button', { name: /Umar/ }))
    await waitFor(() => expect(router.state.location.search).toBe('?view=crit&n=3%2C5'))
    await waitFor(() => expect(calls.criticism.at(-1)).toEqual({ narrator_ids: [3, 5] }))
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Yahya' }))
    await waitFor(() => expect(router.state.location.search).toBe('?view=crit&n=5'))
  })

  it('says when no criticism is recorded for the narrator, as unknown and not as an empty table', async () => {
    mockMe()
    mockComparison(base())
    renderApp('/projects/12/analysis?view=crit&n=6', { signedIn: true })
    expect(await screen.findByText('No statement recorded in the corpus')).toBeInTheDocument()
    expect(screen.getByText('No statement about these narrators is recorded in the corpus.')).toBeInTheDocument()
  })

  it('stores the matrix for the narrators chosen', async () => {
    mockMe()
    const { calls } = mockComparison(base())
    renderApp('/projects/12/analysis?view=crit&n=3,5', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Save analysis' }))
    await waitFor(() => expect(calls.criticism.at(-1)).toEqual({ narrator_ids: [3, 5], save_run: true }))
    expect(await screen.findByText(/Saved as Criticism matrix · v1/)).toBeInTheDocument()
  })
})

describe('Stored analyses', () => {
  const demoMatn = runItem({ id: 13, input_params: { algorithm: 'lexical_ngram_diff', hadith_ids: [101, 102], normalization: 'arabic_strict' }, output_data: { variants: [{ source: 'Bukhari (Humaydi)', plurality: 'بالنيات' }], consensus_core: 'انما الاعمال', lexical_overlap_ratio: 88.4 } })
  const demoChains = runItem({ id: 14, analysis_type: 'isnad_comparison', input_params: { chains_analyzed: 4 }, output_data: { divergence_order: 4, universal_common_link: { name: 'Yahya ibn Saʿīd', frequency: '4/4 (100%)' } } })

  it('opens one from the list: a result in the server’s shape is drawn like the live comparison', async () => {
    mockMe()
    mockComparison(base({ runs: [runItem()] }))
    const { router } = renderApp('/projects/12/analysis', { signedIn: true })
    await screen.findByRole('option', { name: /AN-0021/ })
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Open a saved analysis' }), '21')
    expect(router.state.location.search).toBe('?run=21')
    expect(await screen.findByRole('heading', { level: 1, name: 'Occurrence comparison · v1' })).toBeInTheDocument()
    expect(screen.getByText(/Saved by Shilan Rashid/)).toHaveTextContent('AN-0021 · Saved by Shilan Rashid')
    expect(screen.getByText('Inputs: REP-000101, REP-000102')).toBeInTheDocument()
    expect(await screen.findByRole('article', { name: 'REP-000101' })).toBeInTheDocument()
    expect(screen.queryByText('Stored in another format')).not.toBeInTheDocument()
  })

  it('shows a result in any other shape exactly as stored, and says so, adding nothing', async () => {
    mockMe()
    mockComparison(base({ runs: [demoMatn, demoChains] }))
    renderApp('/projects/12/analysis?run=13', { signedIn: true })
    expect(await screen.findByText('Stored in another format')).toBeInTheDocument()
    expect(screen.getByText('Bukhari (Humaydi)')).toBeInTheDocument()
    expect(screen.getByText('88.4')).toBeInTheDocument()
    expect(screen.getByText('algorithm')).toBeInTheDocument()
    expect(screen.getByText('lexical_ngram_diff')).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('cannot run again or open in the workspace when the inputs are not stored in a usable form', async () => {
    mockMe()
    mockComparison(base({ runs: [demoChains] }))
    renderApp('/projects/12/analysis?run=14', { signedIn: true })
    expect(await screen.findByText(/aren't stored in a form this screen can use/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Run again/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open its inputs in the workspace' })).not.toBeInTheDocument()
  })

  it('runs again as the next version, which leaves this one as it is, and opens the new one', async () => {
    mockMe()
    const { calls } = mockComparison(base({ runs: [demoMatn] }))
    const { router } = renderApp('/projects/12/analysis?run=13', { signedIn: true })
    expect(await screen.findByText('Running it again stores a new version and leaves this one as it is.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Run again as v2' }))
    await waitFor(() => expect(calls.matn.at(-1)).toMatchObject({ hadith_ids: [101, 102], save_run: true }))
    await waitFor(() => expect(router.state.location.search).toBe('?run=101'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Occurrence comparison · v2' })).toBeInTheDocument()
  })

  it('opens the inputs in the workspace so they can be changed', async () => {
    mockMe()
    mockComparison(base({ runs: [demoMatn] }))
    const { router } = renderApp('/projects/12/analysis?run=13', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Open its inputs in the workspace' }))
    await waitFor(() => expect(router.state.location.search).toBe('?view=occ&h=101%2C102'))
    expect(await screen.findByRole('article', { name: 'Sahih al-Bukhari · 1' })).toBeInTheDocument()
  })

  it('offers a viewer no way to store anything', async () => {
    mockMe()
    mockComparison(base({ runs: [demoMatn], role: 'viewer' }))
    renderApp('/projects/12/analysis?run=13', { signedIn: true })
    await screen.findByText('Stored in another format')
    expect(screen.queryByRole('button', { name: /Run again/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open its inputs in the workspace' })).toBeInTheDocument()
  })

  it('shows the same message for an analysis that is not in this project as for one that does not exist', async () => {
    mockMe()
    mockComparison(base())
    const { unmount } = renderApp('/projects/12/analysis?run=999', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'Analysis not available' })).toBeInTheDocument()
    expect(screen.getByText(/Nothing about the other project is revealed/)).toBeInTheDocument()
    unmount()
    server.use(http.get('*/api/v1/projects/12/analyses/:id', () => HttpResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'no' } }, { status: 403 })))
    renderApp('/projects/12/analysis?run=21', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'Analysis not available' })).toBeInTheDocument()
  })

  it('draws a stored chain comparison and a stored matrix when they are in the server’s shape', async () => {
    mockMe()
    const chains = [BUKHARI.chains[0]!, MUSLIM.chains[0]!]
    const narrators = [N(3, 'Yahya')]
    const statements = { 3: [statement(31, critic(80, 'Ibn Maʿīn'), 'ثقة')] }
    mockComparison(
      base({
        runs: [
          runItem({ id: 31, analysis_type: 'isnad_comparison', input_params: { sanad_ids: [1001, 1002] }, output_data: isnadResult(chains) }),
          runItem({ id: 32, analysis_type: 'criticism_matrix', input_params: { narrator_ids: [3] }, output_data: criticismResult([3], narrators, statements) }),
        ],
      }),
    )
    const { router } = renderApp('/projects/12/analysis?run=31', { signedIn: true })
    expect(await screen.findByRole('heading', { level: 1, name: 'Chain comparison · v1' })).toBeInTheDocument()
    expect(await screen.findByText('Inputs: CH-001001, CH-001002')).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'CH-001001' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open its inputs in the workspace' })).not.toBeInTheDocument()
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Open a saved analysis' }), '32')
    expect(await screen.findByRole('heading', { level: 1, name: 'Criticism matrix · v1' })).toBeInTheDocument()
    expect(await screen.findByRole('table', { name: /Who said something about whom/ })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?run=32')
  })
})
