import '@xyflow/react/dist/style.css'
import { Background, Controls, MarkerType, ReactFlow, type Edge, type Node } from '@xyflow/react'
import { useMemo } from 'react'
import type { ArgumentEdge } from '@/api/schemas/argument'
import type { TreeRow } from './argumentModel'
import styles from './Argument.module.css'

interface Props {
  rows: readonly TreeRow[]
  edges: readonly ArgumentEdge[]
  selected: number | null
  onSelect: (id: number | null) => void
  rtl: boolean
  label: string
  typeLabel: (type: string) => string
  relationLabel: (relation: string) => string
}

const COLUMN = 240
const ROW = 96

/**
 * The map as a picture. A point is placed in the column of its depth in the outline, so the top points are at the start
 * and answers go outward. It repeats what the outline holds and is not the only way to read or change it; a point
 * that stands in the outline twice is drawn once, at its first place.
 */
export default function GraphCanvas({ rows, edges, selected, onSelect, rtl, label, typeLabel, relationLabel }: Props) {
  const nodes = useMemo<Node[]>(() => {
    const seen = new Set<number>()
    const slots = new Map<number, number>()
    const out: Node[] = []
    for (const r of rows) {
      if (seen.has(r.node.id)) continue
      seen.add(r.node.id)
      const slot = slots.get(r.depth) ?? 0
      slots.set(r.depth, slot + 1)
      out.push({
        id: String(r.node.id),
        position: { x: (rtl ? -1 : 1) * r.depth * COLUMN, y: slot * ROW },
        data: { label: `${r.number} · ${typeLabel(r.node.node_type)}: ${r.node.title}` },
        selected: r.node.id === selected,
        style: {
          border: r.node.id === selected ? '3px solid var(--accent-dark)' : '1px solid var(--rule-strong)',
          borderRadius: 'var(--radius)',
          background: 'var(--surface-white)',
          color: 'var(--ink)',
          inlineSize: 200,
          padding: 8,
          fontSize: 13,
        },
      })
    }
    return out
  }, [rows, rtl, selected, typeLabel])
  const shown = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes])
  const flowEdges = useMemo<Edge[]>(
    () =>
      edges
        .filter((e) => shown.has(String(e.source_node_id)) && shown.has(String(e.target_node_id)))
        .map((e) => ({
          id: `e${e.id}`,
          source: String(e.source_node_id),
          target: String(e.target_node_id),
          label: relationLabel(e.relation_type),
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: 'var(--ink-2)' },
        })),
    [edges, shown, relationLabel],
  )
  return (
    <div className={styles.canvas} role="group" aria-label={label}>
      <ReactFlow
        nodes={nodes}
        edges={flowEdges}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        fitView
        onNodeClick={(_, node) => onSelect(Number(node.id) === selected ? null : Number(node.id))}
        onPaneClick={() => onSelect(null)}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
