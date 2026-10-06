import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { mockMe, renderApp } from '@/test/helpers'
import { mockComparison, report, runItem, topologyResult, type Chain, type Report } from '@/test/comparisonMocks'

// React Flow needs a layout engine jsdom does not have. The graph is the table's visual companion, so the screen is
// tested through the table, and the canvas is replaced by a stand-in that records what it was given.
vi.mock('./GraphCanvas', () => ({
  default: (props: { rows: { name: string; role: string }[]; edges: unknown[]; selected: string | null; onSelect: (id: string | null) => void; rtl: boolean }) => (
    <div data-testid="graph" data-rtl={String(props.rtl)} data-selected={props.selected ?? ''}>
      graph of {props.rows.length} narrators and {props.edges.length} links
      <button type="button" onClick={() => props.onSelect('2')}>
        pick-in-graph
      </button>
    </div>
  ),
}))

const N = (id: number, name: string) => ({ id, name })
// Corpus order: compiler's teacher first, the earliest source last. Every chain passes Wakīʿ (2) and Sufyān (1).
const chain = (id: number, first: [number, string]): Chain => ({ id, narrators: [N(...first), N(2, 'Wakīʿ'), N(1, 'Sufyān')] })
const reports: Report[] = [
  report(101, { chains: [chain(1001, [10, 'Aḥmad'])] }),
  report(102, { chains: [chain(1002, [11, 'Musaddad']), chain(1003, [12, 'al-Ḥumaydī'])] }),
]
const noCandidates: Report[] = [report(101, { chains: [{ id: 2001, narrators: [N(20, 'A'), N(21, 'B')] }] }), report(102, { chains: [{ id: 2002, narrators: [N(22, 'C'), N(23, 'D')] }] })]

describe('Isnād graph', () => {
  it('asks for at least two reports first, and says the graph is unchecked', async () => {
    mockMe()
    mockComparison({ reports })
    renderApp('/projects/12/analysis/isnad', { signedIn: true })
    expect(await screen.findByText('Choose at least 2 reports')).toBeInTheDocument()
    expect(screen.getByText(/have not been checked by a researcher/)).toBeInTheDocument()
  })

  it('builds the graph from the chains of the chosen reports and lists every narrator with their teachers and students', async () => {
    mockMe()
    const { calls } = mockComparison({ reports })
    renderApp('/projects/12/analysis/isnad?h=101,102', { signedIn: true })
    const table = await screen.findByRole('table', { name: 'The narrators of the graph' })
    expect(calls.topology).toEqual([{ sanad_ids: [1001, 1002, 1003] }])
    const rowOf = (name: string) => within(table).getByRole('button', { name }).closest('tr')!
    const wakii = rowOf('Wakīʿ')
    expect(within(wakii).getByText('Candidate common link')).toBeInTheDocument()
    expect(within(wakii).getByText('Sufyān')).toBeInTheDocument()
    expect(within(wakii).getByText(/Aḥmad · Musaddad · al-Ḥumaydī/)).toBeInTheDocument()
    // The rule also picks the earliest narrator, who is on every chain; only the rule says so, not the screen.
    expect(within(rowOf('Sufyān')).getByText('Candidate common link')).toBeInTheDocument()
    expect(rowOf('Aḥmad')).toHaveTextContent('Where chains end')
  })

  it('says what the graph holds, and gives the server’s rule as a rule of thumb, never a proof', async () => {
    mockMe()
    mockComparison({ reports })
    renderApp('/projects/12/analysis/isnad?h=101,102', { signedIn: true })
    const summary = await screen.findByRole('list', { name: 'What the graph holds' })
    expect(within(summary).getByText('3 chains')).toBeInTheDocument()
    expect(within(summary).getByText('5 narrators')).toBeInTheDocument()
    expect(within(summary).getByText("4 links")).toBeInTheDocument()
    const box = screen.getByRole('region', { name: 'Candidate common links' })
    expect(within(box).getByText(/does not say the narrator is the common link/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/Topological Convergence Theorem|verified_common_link|formal proof/i)
  })

  it('says so when no narrator is picked by the rule', async () => {
    mockMe()
    mockComparison({ reports: noCandidates })
    renderApp('/projects/12/analysis/isnad?h=101,102', { signedIn: true })
    expect(await screen.findByText(/No narrator is picked by the rule/)).toBeInTheDocument()
  })

  it('draws the graph (lazily) beside the table, and hides it on request through the address', async () => {
    mockMe()
    mockComparison({ reports })
    const { router } = renderApp('/projects/12/analysis/isnad?h=101,102', { signedIn: true })
    expect(await screen.findByTestId('graph')).toHaveTextContent('graph of 5 narrators and 4 links')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Draw the graph' }))
    expect(screen.queryByTestId('graph')).not.toBeInTheDocument()
    expect(router.state.location.search).toContain('graph=0')
    expect(screen.getByRole('table', { name: 'The narrators of the graph' })).toBeInTheDocument()
  })

  it('chooses a narrator from the table or the graph, in the address, and shows their links and a dossier link', async () => {
    mockMe()
    mockComparison({ reports })
    const { router } = renderApp('/projects/12/analysis/isnad?h=101,102', { signedIn: true })
    const table = await screen.findByRole('table', { name: 'The narrators of the graph' })
    await userEvent.click(within(table).getByRole('button', { name: 'Sufyān' }))
    expect(router.state.location.search).toContain('node=1')
    const panel = screen.getByRole('complementary', { name: 'The narrator in focus' })
    expect(within(panel).getByRole('heading', { name: 'Sufyān' })).toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: 'Open the narrator dossier' })).toHaveAttribute('href', '/projects/12/analysis?view=dossier&narrator=1')
    await userEvent.click(screen.getByRole('button', { name: 'pick-in-graph' }))
    expect(router.state.location.search).toContain('node=2')
    expect(screen.getByTestId('graph')).toHaveAttribute('data-selected', '2')
  })

  it('shows only the chains through the narrator in focus', async () => {
    mockMe()
    mockComparison({ reports })
    renderApp('/projects/12/analysis/isnad?h=101,102&node=11', { signedIn: true })
    const chains = await screen.findByRole('region', { name: 'The chains' })
    await waitFor(() => expect(within(chains).getAllByRole('listitem')).toHaveLength(3))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show only the chains through this narrator' }))
    await waitFor(() => expect(within(chains).getAllByRole('listitem')).toHaveLength(1))
    expect(within(chains).getByText(/Musaddad/)).toBeInTheDocument()
  })

  it('says a graph needs two chains when the reports have fewer, and leaves out reports the corpus does not have', async () => {
    mockMe()
    mockComparison({ reports: [report(101, { chains: [chain(1001, [10, 'Aḥmad'])] }), report(102, { chains: [] })] })
    renderApp('/projects/12/analysis/isnad?h=101,102,999', { signedIn: true })
    expect(await screen.findByText(/have 1 chain\(s\) recorded; a graph needs at least two/)).toBeInTheDocument()
    expect(screen.getByText(/could not be found in the corpus.*999/)).toBeInTheDocument()
  })

  it('shows the server’s failure with a retry and draws nothing', async () => {
    mockMe()
    mockComparison({ reports, topology: () => HttpResponse.json({ success: false, error: { code: 'TOPOLOGY_ERROR', message: 'boom' } }, { status: 422 }) })
    renderApp('/projects/12/analysis/isnad?h=101,102', { signedIn: true })
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'The narrators of the graph' })).not.toBeInTheDocument()
  })

  it('saves the graph as a run for a role that can add shared research, and says which', async () => {
    mockMe()
    const { calls } = mockComparison({ reports })
    renderApp('/projects/12/analysis/isnad?h=101,102', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Save this graph' }))
    await waitFor(() => expect(calls.topology.at(-1)).toMatchObject({ save_run: true }))
    expect(await screen.findByText(/Saved as AN-0100 · v1/)).toBeInTheDocument()
  })

  it('lets a viewer look but not save', async () => {
    mockMe()
    mockComparison({ reports, role: 'viewer' })
    renderApp('/projects/12/analysis/isnad?h=101,102', { signedIn: true })
    await screen.findByRole('table', { name: 'The narrators of the graph' })
    expect(screen.queryByRole('button', { name: 'Save this graph' })).not.toBeInTheDocument()
    expect(screen.getByText(/Saving one needs a role that can add shared research/)).toBeInTheDocument()
  })

  it('opens a saved graph from what the server stored, without computing it again, and without the chain list', async () => {
    mockMe()
    const { calls } = mockComparison({
      reports,
      runs: [runItem({ id: 41, analysis_type: 'isnad_topology', input_params: { sanad_ids: [1001, 1002] }, output_data: topologyResult([chain(1001, [10, 'Aḥmad']), chain(1002, [11, 'Musaddad'])]), version_number: 1 })],
    })
    renderApp('/projects/12/analysis/isnad?run=41', { signedIn: true })
    expect(await screen.findByRole('heading', { level: 1, name: 'Isnād graph AN-0041 · v1' })).toBeInTheDocument()
    expect(await screen.findByRole('table', { name: 'The narrators of the graph' })).toBeInTheDocument()
    expect(calls.topology).toEqual([])
    expect(screen.queryByRole('region', { name: 'The chains' })).not.toBeInTheDocument()
  })

  it('says a stored analysis in another form is not drawn as a graph', async () => {
    mockMe()
    mockComparison({ reports, runs: [runItem({ id: 42, analysis_type: 'isnad_topology', output_data: { something: 'else' } })] })
    renderApp('/projects/12/analysis/isnad?run=42', { signedIn: true })
    expect(await screen.findByText(/not a graph in the form this screen can draw/)).toBeInTheDocument()
  })

  it('lists saved graphs, and says when there are none', async () => {
    mockMe()
    mockComparison({ reports })
    renderApp('/projects/12/analysis/isnad', { signedIn: true })
    expect(await screen.findByText('No graph has been saved in this project.')).toBeInTheDocument()
  })

  it('tells the graph which way to read, from the page direction', async () => {
    mockMe()
    mockComparison({ reports })
    renderApp('/projects/12/analysis/isnad?h=101,102', { signedIn: true })
    expect(await screen.findByTestId('graph')).toHaveAttribute('data-rtl', 'false')
  })
})
