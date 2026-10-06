import { describe, expect, it } from 'vitest'
import type { IsnadChain } from '@/api/schemas/analyses'
import type { Topology } from '@/api/schemas/isnad'
import { chainsThrough, generationCount, layoutLayers, narratorRows } from './isnadModel'

const topology = (over: Partial<Topology> = {}): Topology => ({
  total_sanads_analyzed: 3,
  madar_al_isnad: { narrator_id: 2, name: 'Wakīʿ', out_degree: 2, in_degree: 1, chain_coverage: 100 },
  partial_common_links: [],
  graph_topology: {
    nodes: [
      { id: 1, name: 'Sufyān', in_degree: 0, out_degree: 1, frequency: 3 },
      { id: 2, name: 'Wakīʿ', in_degree: 1, out_degree: 2, frequency: 3 },
      { id: 3, name: 'Aḥmad', in_degree: 1, out_degree: 0, frequency: 2 },
      { id: 4, name: 'Musaddad', in_degree: 1, out_degree: 0, frequency: 1 },
    ],
    edges: [
      { source: 1, target: 2, weight: 3 },
      { source: 2, target: 3, weight: 2 },
      { source: 2, target: 4, weight: 1 },
    ],
  },
  ...over,
})

describe('narratorRows', () => {
  it('lists the narrator the rule picked first, with who they link to and how many chains pass', () => {
    const rows = narratorRows(topology())
    expect(rows[0]).toMatchObject({ name: 'Wakīʿ', candidate: true, role: 'candidate', chains: 3 })
    expect(rows[0]?.teachers.map((t) => t.name)).toEqual(['Sufyān'])
    expect(rows[0]?.students.map((s) => s.name)).toEqual(['Aḥmad', 'Musaddad'])
  })
  it('says where chains begin and end, and never calls anything proved', () => {
    const rows = narratorRows(topology())
    expect(rows.find((r) => r.name === 'Sufyān')?.role).toBe('start')
    expect(rows.find((r) => r.name === 'Aḥmad')?.role).toBe('end')
    expect(JSON.stringify(rows)).not.toMatch(/proof|verified|theorem/i)
  })
  it('puts the others in order of how many chains pass through them', () => {
    expect(narratorRows(topology()).map((r) => r.name)).toEqual(['Wakīʿ', 'Sufyān', 'Aḥmad', 'Musaddad'])
  })
  it('handles ids that are text (custom chains) and a graph with no candidate', () => {
    const t = topology({ madar_al_isnad: null })
    expect(narratorRows(t).every((r) => !r.candidate)).toBe(true)
    expect(narratorRows(t).find((r) => r.name === 'Wakīʿ')?.role).toBe('passes')
    expect(narratorRows(t)[0]?.numericId).not.toBeNull()
  })
})

describe('layoutLayers', () => {
  it('puts each narrator one column after the latest of their teachers', () => {
    const t = topology()
    const placed = layoutLayers(t.graph_topology.nodes, t.graph_topology.edges)
    const layer = (id: number) => placed.find((p) => p.id === String(id))?.layer
    expect([layer(1), layer(2), layer(3), layer(4)]).toEqual([0, 1, 2, 2])
    expect(generationCount(placed)).toBe(3)
  })
  it('orders a column by name', () => {
    const t = topology()
    const col = layoutLayers(t.graph_topology.nodes, t.graph_topology.edges).filter((p) => p.layer === 2)
    expect(col.map((p) => p.id)).toEqual(['3', '4'])
  })
  it('ends when the data has a loop, and ignores a link from a narrator to themselves', () => {
    const placed = layoutLayers([{ id: 1, name: 'A' }, { id: 2, name: 'B' }], [{ source: 1, target: 2 }, { source: 2, target: 1 }, { source: 1, target: 1 }])
    expect(placed).toHaveLength(2)
  })
  it('places a narrator with no links, and ignores a link to a narrator that is not in the graph', () => {
    const placed = layoutLayers([{ id: 1, name: 'A' }, { id: 2, name: 'B' }], [{ source: 1, target: 99 }])
    expect(placed.map((p) => p.layer)).toEqual([0, 0])
  })
})

describe('chainsThrough', () => {
  const chain = (sanad_id: number, ids: number[]) => ({ sanad_id, length: ids.length, narrators: ids.map((narrator_id, i) => ({ order: i + 1, narrator_id, name: `N${narrator_id}` })) }) as IsnadChain
  it('keeps the chains that pass through the narrator, or all of them when none is chosen', () => {
    const chains = [chain(1, [5, 2, 1]), chain(2, [6, 2, 1]), chain(3, [7, 8, 1])]
    expect(chainsThrough(chains, 2).map((c) => c.sanad_id)).toEqual([1, 2])
    expect(chainsThrough(chains, null)).toHaveLength(3)
    expect(chainsThrough(chains, 99)).toEqual([])
  })
})
