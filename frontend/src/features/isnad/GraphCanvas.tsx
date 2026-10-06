import '@xyflow/react/dist/style.css'
import { Background, Controls, MarkerType, ReactFlow, type Edge, type Node } from '@xyflow/react'
import { useMemo } from 'react'
import type { TopologyEdge } from '@/api/schemas/isnad'
import { idKey, layoutLayers, type NarratorRow } from './isnadModel'
import styles from './Isnad.module.css'

interface Props {
  rows: readonly NarratorRow[]
  edges: readonly TopologyEdge[]
  selected: string | null
  onSelect: (id: string | null) => void
  /** Right-to-left pages draw the earliest transmitters on the right, so the chain reads as the text does. */
  rtl: boolean
  label: string
  roleLabel: (role: NarratorRow['role']) => string
  countLabel: (n: number) => string
}

const COLUMN = 220
const ROW = 90

/**
 * The transmission graph, drawn with React Flow. Arrows run from teacher to student. It is the visual companion of the
 * table beside it, not the only way in: everything on it is also in the table, and a narrator is chosen from either.
 * A candidate narrator has a heavier outline AND the word "candidate" on it (never colour alone).
 */
export default function GraphCanvas({ rows, edges, selected, onSelect, rtl, label, roleLabel, countLabel }: Props) {
  const placed = useMemo(() => layoutLayers(rows.map((r) => ({ id: r.id, name: r.name })), edges), [rows, edges])
  const nodes = useMemo<Node[]>(
    () =>
      rows.map((r) => {
        const at = placed.find((p) => p.id === r.id) ?? { layer: 0, slot: 0 }
        return {
          id: r.id,
          position: { x: (rtl ? -1 : 1) * at.layer * COLUMN, y: at.slot * ROW },
          data: { label: `${r.name} · ${countLabel(r.chains)} · ${roleLabel(r.role)}` },
          selected: r.id === selected,
          style: {
            border: r.candidate ? '3px solid var(--accent-dark)' : '1px solid var(--rule-strong)',
            borderRadius: 'var(--radius)',
            background: 'var(--surface-white)',
            color: 'var(--ink)',
            inlineSize: 180,
            padding: 8,
            fontSize: 13,
            outline: r.id === selected ? '2px solid var(--accent)' : 'none',
          },
        }
      }),
    [rows, placed, rtl, selected, roleLabel, countLabel],
  )
  const flowEdges = useMemo<Edge[]>(
    () =>
      edges.map((e) => ({
        id: `${idKey(e.source)}->${idKey(e.target)}`,
        source: idKey(e.source),
        target: idKey(e.target),
        label: e.weight > 1 ? String(e.weight) : undefined,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: 'var(--ink-2)' },
      })),
    [edges],
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
        onNodeClick={(_, node) => onSelect(node.id === selected ? null : node.id)}
        onPaneClick={() => onSelect(null)}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
