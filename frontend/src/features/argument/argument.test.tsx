import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { envelope, mockMe, renderApp } from '@/test/helpers'
import { mockProjectApis, projectDetail } from '@/test/projectMocks'
import { server } from '@/test/server'
import { evidenceItem, mockWriting } from '@/test/writingMocks'

vi.mock('./GraphCanvas', () => ({
  default: (props: { rows: { node: { id: number; title: string } }[]; edges: unknown[] }) => (
    <div data-testid="graph">
      graph of {props.rows.length} points and {props.edges.length} relations
    </div>
  ),
}))

const node = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  project_id: 12,
  node_type: 'premise',
  title: `Point ${id}`,
  content: `Text of point ${id}`,
  evidence_id: null,
  finding_id: null,
  order_index: id,
  created_at: '2026-10-01T09:00:00Z',
  creator: { id: 1, display_name: 'Shilan Rashid', email: 'x@example.org' },
  ...over,
})
const edge = (id: number, source: number, target: number, relation = 'supports') => ({ id, project_id: 12, source_node_id: source, target_node_id: target, relation_type: relation, notes: null })

const base = {
  nodes: [
    node(1, { node_type: 'claim', title: 'The claim', finding_id: 4, finding: { id: 4, claim: 'Three-times wording is shortest' } }),
    node(2, { title: 'A premise', evidence_id: 4, evidence: { id: 4, captured_text: 'تَوَضَّأَ ثَلاَثًا', locator: 'Vol. 1, p. 78', state: 'included' } }),
    node(3, { node_type: 'objection', title: 'An objection' }),
    node(4, { node_type: 'reply', title: 'A reply' }),
    node(5, { title: 'Unrelated' }),
  ],
  edges: [edge(1, 2, 1), edge(2, 3, 1, 'refutes'), edge(3, 4, 3, 'replies_to')],
}

function mockArgument(graph: { nodes: unknown[]; edges: unknown[] } = base, viewer = false) {
  const calls = { nodes: [] as Record<string, unknown>[], edges: [] as Record<string, unknown>[], patched: [] as Record<string, unknown>[], deletedNodes: [] as string[], deletedEdges: [] as string[] }
  let nextId = 20
  mockWriting()
  mockProjectApis(12, { detail: projectDetail(viewer ? { owner_id: 9, memberships: [{ user_id: 1, role: 'viewer', status: 'accepted', user: { id: 1, display_name: 'Shilan Rashid' } }] } : {}) })
  server.use(
    http.get('*/api/v1/projects/12/argument-graph', () => HttpResponse.json(envelope({ ...graph, cytoscape: { nodes: [], edges: [] }, summary: {} }))),
    http.post('*/api/v1/projects/12/argument-nodes', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.nodes.push(body)
      return HttpResponse.json(envelope(node(nextId++, body)), { status: 201 })
    }),
    http.patch('*/api/v1/projects/12/argument-nodes/:id', async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.patched.push(body)
      return HttpResponse.json(envelope(node(Number(params.id), body)))
    }),
    http.delete('*/api/v1/projects/12/argument-nodes/:id', ({ params }) => {
      calls.deletedNodes.push(String(params.id))
      return HttpResponse.json(envelope(null))
    }),
    http.post('*/api/v1/projects/12/argument-edges', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.edges.push(body)
      return HttpResponse.json(envelope({ id: nextId++, ...body }), { status: 201 })
    }),
    http.delete('*/api/v1/projects/12/argument-edges/:id', ({ params }) => {
      calls.deletedEdges.push(String(params.id))
      return HttpResponse.json(envelope(null))
    }),
    http.get('*/api/v1/projects/12/evidence', () => HttpResponse.json(envelope([evidenceItem(4)], { pagination: { current_page: 1, per_page: 100, total_items: 1, total_pages: 1, has_more: false } }))),
  )
  return calls
}

describe('Argument map', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:fake')
    URL.revokeObjectURL = vi.fn()
    HTMLAnchorElement.prototype.click = vi.fn()
  })

  it('exports the structure and says what the file leaves out', async () => {
    mockMe()
    mockArgument()
    const asked: string[] = []
    server.use(
      http.get('*/api/v1/projects/12/exports/graph', ({ request }) => {
        asked.push(request.url)
        return HttpResponse.json(envelope({ project_id: 12, graph: { nodes: [], edges: [] }, summary: { total_nodes: 5, total_edges: 3 } }))
      }),
    )
    const user = userEvent.setup()
    renderApp('/projects/12/argument-map', { signedIn: true })
    await user.click(await screen.findByRole('button', { name: 'Export structure' }))
    expect(await screen.findByText(/Saved argument-map-PRJ-0012\.json: 5 points and 3 relations\. It does not carry the evidence links/)).toBeInTheDocument()
    expect(asked).toHaveLength(1)
  })

  it('says the platform does not judge and shows the outline numbered from the claim', async () => {
    mockMe()
    mockArgument()
    renderApp('/projects/12/argument-map', { signedIn: true })
    expect(await screen.findByText(/does not judge an argument/)).toBeInTheDocument()
    const outline = await screen.findByRole('list', { name: 'Points of the argument' })
    const items = within(outline).getAllByRole('listitem')
    expect(items.map((li) => li.textContent?.match(/^\d+(\.\d+)*/)?.[0])).toEqual(['1', '1.1', '1.2', '1.2.1', '2'])
    expect(within(items[2]!).getByText(/reasoning only/))
  })

  it('shows a point with its source, locator, relations and no account details', async () => {
    mockMe()
    mockArgument()
    const user = userEvent.setup()
    renderApp('/projects/12/argument-map?node=2', { signedIn: true })
    const article = await screen.findByRole('article', { name: 'A premise' })
    expect(within(article).getByRole('link', { name: 'EV-0004' })).toHaveAttribute('href', '/projects/12/evidence?item=4')
    expect(within(article).getByText(/Vol\. 1, p\. 78/)).toBeInTheDocument()
    expect(within(article).getByRole('list', { name: 'This point answers:' })).toHaveTextContent('The claim')
    expect(document.body).not.toHaveTextContent('x@example.org')
    await user.click(screen.getByRole('button', { name: /^1\.2 /i }))
    expect(await screen.findByRole('article', { name: 'An objection' })).toBeInTheDocument()
  })

  it('says a point with no evidence is reasoning only', async () => {
    mockMe()
    mockArgument()
    renderApp('/projects/12/argument-map?node=3', { signedIn: true })
    const article = await screen.findByRole('article', { name: 'An objection' })
    expect(within(article).getByText('This point is reasoning only, with no source linked.')).toBeInTheDocument()
  })

  it('narrows the map to the points connected to a finding', async () => {
    mockMe()
    mockArgument()
    const user = userEvent.setup()
    renderApp('/projects/12/argument-map', { signedIn: true })
    await user.selectOptions(await screen.findByLabelText('Show the map of'), '4')
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Points of the argument' })).getAllByRole('listitem')).toHaveLength(4))
    expect(screen.queryByText('Unrelated')).not.toBeInTheDocument()
  })

  it('shows the graph view from the same data', async () => {
    mockMe()
    mockArgument()
    renderApp('/projects/12/argument-map?view=graph', { signedIn: true })
    expect(await screen.findByTestId('graph')).toHaveTextContent('graph of 5 points and 3 relations')
  })

  it('puts points that can only be reached through a loop apart and says so', async () => {
    mockMe()
    mockArgument({ nodes: [node(1), node(2)], edges: [edge(1, 1, 2), edge(2, 2, 1)] })
    renderApp('/projects/12/argument-map', { signedIn: true })
    expect(await screen.findByRole('alert')).toHaveTextContent(/in a loop/)
  })

  it('adds a top point, and adds an answer that is created and then linked', async () => {
    mockMe()
    const calls = mockArgument()
    const user = userEvent.setup()
    renderApp('/projects/12/argument-map?node=1', { signedIn: true })
    await user.click(await screen.findByRole('button', { name: 'Add a point that answers this' }))
    const dlg = await screen.findByRole('dialog', { name: /Answer “The claim”/ })
    await user.selectOptions(within(dlg).getByLabelText(/^Kind of point/), 'objection')
    expect((within(dlg).getByLabelText(/^How it relates/) as HTMLSelectElement).value).toBe('refutes')
    await user.click(within(dlg).getByRole('button', { name: 'Save point' }))
    expect(await within(dlg).findByText('Give the point a title.')).toBeInTheDocument()
    await user.type(within(dlg).getByLabelText(/^Short title/), 'New objection')
    await user.type(within(dlg).getByLabelText(/^The point/), 'Because.')
    await user.click(within(dlg).getByRole('button', { name: 'Save point' }))
    await waitFor(() => expect(calls.edges).toHaveLength(1))
    expect(calls.nodes[0]).toMatchObject({ node_type: 'objection', title: 'New objection', content: 'Because.' })
    expect(calls.edges[0]).toMatchObject({ source_node_id: 20, target_node_id: 1, relation_type: 'refutes' })
  })

  it('says so when the point was added but linking it failed', async () => {
    mockMe()
    mockArgument()
    server.use(http.post('*/api/v1/projects/12/argument-edges', () => HttpResponse.json({ message: 'no' }, { status: 500 })))
    const user = userEvent.setup()
    renderApp('/projects/12/argument-map?node=1', { signedIn: true })
    await user.click(await screen.findByRole('button', { name: 'Add a point that answers this' }))
    const dlg = await screen.findByRole('dialog')
    await user.type(within(dlg).getByLabelText(/^Short title/), 'T')
    await user.type(within(dlg).getByLabelText(/^The point/), 'C')
    await user.click(within(dlg).getByRole('button', { name: 'Save point' }))
    expect(await within(dlg).findByText(/The point was added, but linking it/)).toBeInTheDocument()
  })

  it('refuses a relation that would make a loop before asking the server', async () => {
    mockMe()
    const calls = mockArgument()
    const user = userEvent.setup()
    renderApp('/projects/12/argument-map?node=1', { signedIn: true })
    await user.click(await screen.findByRole('button', { name: 'Make this answer another point' }))
    const dlg = await screen.findByRole('dialog')
    await user.selectOptions(within(dlg).getByLabelText(/^The point it answers/), '2')
    await user.click(within(dlg).getByRole('button', { name: 'Add relation' }))
    expect(await within(dlg).findByText('That would make the points answer each other in a loop.')).toBeInTheDocument()
    expect(calls.edges).toEqual([])
  })

  it('removes a relation and deletes a point after confirmation', async () => {
    mockMe()
    const calls = mockArgument()
    const user = userEvent.setup()
    renderApp('/projects/12/argument-map?node=2', { signedIn: true })
    await user.click(await screen.findByRole('button', { name: 'Remove the relation with The claim' }))
    await waitFor(() => expect(calls.deletedEdges).toEqual(['1']))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(calls.deletedNodes).toEqual([])
    const confirm = await screen.findByRole('dialog')
    await user.click(within(confirm).getByRole('button', { name: 'Delete point' }))
    await waitFor(() => expect(calls.deletedNodes).toEqual(['2']))
  })

  it('shows an empty state, and a viewer sees no buttons that change the map', async () => {
    mockMe()
    mockArgument({ nodes: [], edges: [] })
    renderApp('/projects/12/argument-map', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'No argument structure yet' })).toBeInTheDocument()
  })

  it('gives a viewer the map without editing buttons', async () => {
    mockMe()
    mockArgument(base, true)
    renderApp('/projects/12/argument-map?node=2', { signedIn: true })
    await screen.findByRole('article', { name: 'A premise' })
    for (const name of ['Add a point', 'Edit', 'Delete', 'Add a point that answers this']) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Remove the relation/ })).not.toBeInTheDocument()
  })
})
