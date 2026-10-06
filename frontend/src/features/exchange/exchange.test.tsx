import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { envelope, mockMe, project, renderApp } from '@/test/helpers'
import { mockProjectList } from '@/test/projectMocks'
import { server } from '@/test/server'

const graph = (nodes = 2, edges = 1) => ({
  project_id: 12,
  format: 'cytoscape',
  graph: {
    nodes: Array.from({ length: nodes }, (_, i) => ({ data: { id: `arg_${i + 1}`, label: `P${i + 1}`, type: 'claim', content: 'text' } })),
    edges: Array.from({ length: edges }, (_, i) => ({ data: { id: `edge_${i + 1}`, source: 'arg_1', target: 'arg_2', relation: 'supports' } })),
  },
  summary: { total_nodes: nodes, total_edges: edges },
})

const readBlob = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })

let saved: { blob: Blob; name: string }[]
beforeEach(() => {
  saved = []
  URL.createObjectURL = vi.fn((b: Blob) => {
    saved.push({ blob: b, name: '' })
    return 'blob:fake'
  })
  URL.revokeObjectURL = vi.fn()
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    const last = saved.at(-1)
    if (last) last.name = this.download
  }
})

function mockExchange(over: { status?: number; data?: unknown } = {}) {
  const calls = { graph: [] as string[] }
  mockProjectList({ owned: [project({ id: 12, title: 'Chains of the wuḍūʾ reports' })] })
  server.use(
    http.get('*/api/v1/projects/:id/exports/graph', ({ params }) => {
      calls.graph.push(String(params.id))
      return over.status ? HttpResponse.json({ message: 'x' }, { status: over.status }) : HttpResponse.json(envelope(over.data ?? graph()))
    }),
  )
  return calls
}

describe('Export and package import', () => {
  it('offers the argument map export and says plainly what is not available', async () => {
    mockMe()
    mockExchange()
    renderApp('/downloads/import', { signedIn: true })
    expect(await screen.findByRole('heading', { level: 1, name: 'Other exports and importing a package' })).toBeInTheDocument()
    expect(screen.getByText(/does not carry the evidence or finding a point is linked to/)).toBeInTheDocument()
    expect(screen.getByText(/makes the same ZIP of JSON files whatever format is asked for/)).toBeInTheDocument()
    expect(screen.getByText(/makes an empty project: it keeps none of the package's evidence/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/file/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start a blank project' })).toHaveAttribute('href', '/projects/new')
  })

  it('needs a project before it can download', async () => {
    mockMe()
    mockExchange()
    renderApp('/downloads/import', { signedIn: true })
    expect(await screen.findByRole('button', { name: 'Download JSON' })).toBeDisabled()
  })

  it('downloads the dataset only, named after the project, and says how many points and relations it holds', async () => {
    mockMe()
    const calls = mockExchange()
    const user = userEvent.setup()
    renderApp('/downloads/import', { signedIn: true })
    await user.selectOptions(await screen.findByLabelText(/^Project/), '12')
    await user.click(screen.getByRole('button', { name: 'Download JSON' }))
    expect(await screen.findByText(/Saved argument-map-PRJ-0012\.json: 2 points and 1 relations\./)).toBeInTheDocument()
    expect(calls.graph).toEqual(['12'])
    expect(saved).toHaveLength(1)
    expect(saved[0]!.name).toBe('argument-map-PRJ-0012.json')
    const text = await readBlob(saved[0]!.blob)
    const parsed = JSON.parse(text)
    expect(Object.keys(parsed).sort()).toEqual(['graph', 'project_id', 'summary'])
    expect(parsed.graph.nodes).toHaveLength(2)
  })

  it('reports a failed export and saves nothing', async () => {
    mockMe()
    mockExchange({ status: 500 })
    const user = userEvent.setup()
    renderApp('/downloads/import?project=12', { signedIn: true })
    await user.click(await screen.findByRole('button', { name: 'Download JSON' }))
    expect(await screen.findByText(/The file was not saved/)).toBeInTheDocument()
    expect(saved).toEqual([])
  })

  it('is reachable from the Downloads page', async () => {
    mockMe()
    mockExchange()
    server.use(http.get('*/api/v1/exports', () => HttpResponse.json(envelope([], { pagination: { current_page: 1, per_page: 20, total_items: 0, total_pages: 1, has_more: false } }))), http.get('*/api/v1/exports/quota', () => HttpResponse.json(envelope({ running: 0, queued: 0, limit: 2 }))))
    renderApp('/downloads', { signedIn: true })
    expect(await screen.findByRole('link', { name: 'Other exports and importing a package' })).toHaveAttribute('href', '/downloads/import')
  })
})
