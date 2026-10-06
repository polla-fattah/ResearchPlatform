import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import GraphCanvas from './GraphCanvas'
import { narratorRows } from './isnadModel'
import type { Topology } from '@/api/schemas/isnad'

// jsdom has no layout engine: React Flow needs these two to start, and measures everything as 0 x 0. What is checked here
// is what the canvas is given and what it announces, not where it draws.
beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  vi.stubGlobal('DOMMatrixReadOnly', class { m22 = 1 })
})

const topology: Topology = {
  graph_topology: {
    nodes: [
      { id: 1, name: 'Sufyān', in_degree: 0, out_degree: 1, frequency: 2 },
      { id: 2, name: 'Wakīʿ', in_degree: 1, out_degree: 2, frequency: 2 },
    ],
    edges: [{ source: 1, target: 2, weight: 2 }],
  },
  madar_al_isnad: { narrator_id: 2, name: 'Wakīʿ' },
}

describe('GraphCanvas', () => {
  it('names itself for assistive technology and says on each narrator how many chains pass and what it is', () => {
    const rows = narratorRows(topology)
    render(
      <GraphCanvas
        rows={rows}
        edges={topology.graph_topology.edges}
        selected={null}
        onSelect={() => undefined}
        rtl={false}
        label="Transmission graph. The same narrators and links are in the table below."
        roleLabel={(r) => `role:${r}`}
        countLabel={(n) => `on ${n} chains`}
      />,
    )
    expect(screen.getByRole('group', { name: /The same narrators and links are in the table below/ })).toBeInTheDocument()
    expect(screen.getByText('Wakīʿ · on 2 chains · role:candidate')).toBeInTheDocument()
    expect(screen.getByText('Sufyān · on 2 chains · role:start')).toBeInTheDocument()
  })
})
