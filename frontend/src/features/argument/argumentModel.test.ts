import { describe, expect, it } from 'vitest'
import { buildOutline, hasRelation, linkedFindings, mapOfFinding, wouldLoop } from './argumentModel'

const n = (id: number, over: Record<string, unknown> = {}) => ({ id, node_type: 'claim', title: `P${id}`, content: 'c', evidence_id: null, finding_id: null, order_index: 0, ...over })
const e = (id: number, source: number, target: number, relation = 'supports') => ({ id, source_node_id: source, target_node_id: target, relation_type: relation })

describe('argument model', () => {
  it('lays points out under the point they answer, numbered from the top', () => {
    const { rows, loops } = buildOutline([n(1), n(2), n(3), n(4)], [e(1, 2, 1), e(2, 3, 1, 'refutes'), e(3, 4, 3, 'replies_to')])
    expect(rows.map((r) => [r.node.id, r.number, r.depth, r.relation])).toEqual([
      [1, '1', 0, null],
      [2, '1.1', 1, 'supports'],
      [3, '1.2', 1, 'refutes'],
      [4, '1.2.1', 2, 'replies_to'],
    ])
    expect(loops).toEqual([])
  })
  it('puts a point that answers two points under each', () => {
    const { rows } = buildOutline([n(1), n(2), n(3)], [e(1, 3, 1), e(2, 3, 2)])
    expect(rows.filter((r) => r.node.id === 3).map((r) => r.number)).toEqual(['1.1', '2.1'])
  })
  it('does not walk a loop forever and returns the points only a loop reaches', () => {
    const { rows, loops } = buildOutline([n(1), n(2), n(3)], [e(1, 2, 3), e(2, 3, 2), e(3, 1, 9)])
    expect(rows.map((r) => r.node.id)).toEqual([1])
    expect(loops.map((l) => l.id)).toEqual([2, 3])
  })
  it('orders siblings by order_index then id, and ignores edges to missing points', () => {
    const { rows } = buildOutline([n(1), n(2, { order_index: 5 }), n(3, { order_index: 1 })], [e(1, 2, 1), e(2, 3, 1), e(3, 1, 99)])
    expect(rows.map((r) => r.node.id)).toEqual([1, 3, 2])
  })
  it('sees a loop before it is made, directly or through others', () => {
    const edges = [e(1, 2, 1), e(2, 3, 2)]
    expect(wouldLoop(edges, 1, 1)).toBe(true)
    expect(wouldLoop(edges, 1, 3)).toBe(true)
    expect(wouldLoop(edges, 3, 1)).toBe(false)
  })
  it('knows a relation already exists', () => {
    expect(hasRelation([e(1, 2, 1)], 2, 1, 'supports')).toBe(true)
    expect(hasRelation([e(1, 2, 1)], 2, 1, 'refutes')).toBe(false)
  })
  it('takes the map of one finding as every point connected to it', () => {
    const nodes = [n(1, { finding_id: 7 }), n(2), n(3), n(4)]
    const map = mapOfFinding(nodes, [e(1, 2, 1), e(2, 3, 2), e(3, 4, 4)], 7)
    expect(map.nodes.map((x) => x.id)).toEqual([1, 2, 3])
    expect(map.edges.map((x) => x.id)).toEqual([1, 2])
  })
  it('lists each linked finding once', () => {
    expect(linkedFindings([n(1, { finding_id: 7, finding: { id: 7, claim: 'A' } }), n(2, { finding_id: 7 }), n(3)])).toEqual([{ id: 7, label: 'A' }])
  })
})
