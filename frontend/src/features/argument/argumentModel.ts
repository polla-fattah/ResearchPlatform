import {
  NODE_TYPES,
  RELATIONS,
  type ArgumentEdge,
  type ArgumentNode,
  type NodeType,
  type Relation,
} from '@/api/schemas/argument'

export const isNodeType = (v: string): v is NodeType => (NODE_TYPES as readonly string[]).includes(v)
export const isRelation = (v: string): v is Relation => (RELATIONS as readonly string[]).includes(v)

/** The relation a new point most often has to the one it answers; the person can change it. */
export const DEFAULT_RELATION: Record<NodeType, Relation> = {
  premise: 'supports',
  claim: 'supports',
  objection: 'refutes',
  reply: 'replies_to',
  qualification: 'qualifies',
  alternative_conclusion: 'alternative_to',
}

export interface TreeRow {
  node: ArgumentNode
  /** "1", "1.2", "1.2.1": where the point stands, counted from the top. */
  number: string
  depth: number
  /** The relation to the point above it (absent for a top point), and the edge that holds it. */
  relation: Relation | string | null
  edgeId: number | null
}

/**
 * The map as an outline. A point that answers another (source) stands under the point it answers (target), so the
 * top points are the ones that answer nothing. A point answering two points appears under each. The server only refuses a
 * point answering itself, so longer loops can exist; a point already on the way down is not entered again, and points
 * that can only be reached through a loop are returned apart as `loops`.
 */
export function buildOutline(nodes: readonly ArgumentNode[], edges: readonly ArgumentEdge[]): { rows: TreeRow[]; loops: ArgumentNode[] } {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const valid = edges.filter((e) => byId.has(e.source_node_id) && byId.has(e.target_node_id))
  const answersSomething = new Set(valid.map((e) => e.source_node_id))
  const order = (a: ArgumentNode, b: ArgumentNode) => (a.order_index ?? 0) - (b.order_index ?? 0) || a.id - b.id
  const childrenOf = (id: number) =>
    valid
      .filter((e) => e.target_node_id === id)
      .map((e) => ({ edge: e, node: byId.get(e.source_node_id)! }))
      .sort((a, b) => order(a.node, b.node))

  const rows: TreeRow[] = []
  const reached = new Set<number>()
  const walk = (node: ArgumentNode, number: string, depth: number, path: ReadonlySet<number>, relation: string | null, edgeId: number | null) => {
    rows.push({ node, number, depth, relation, edgeId })
    reached.add(node.id)
    const next = new Set(path).add(node.id)
    childrenOf(node.id)
      .filter((c) => !next.has(c.node.id))
      .forEach((c, i) => walk(c.node, `${number}.${i + 1}`, depth + 1, next, c.edge.relation_type, c.edge.id))
  }
  const tops = [...nodes].filter((n) => !answersSomething.has(n.id)).sort(order)
  tops.forEach((n, i) => walk(n, String(i + 1), 0, new Set(), null, null))
  return { rows, loops: nodes.filter((n) => !reached.has(n.id)).sort(order) }
}

/** Whether "source answers target" would close a loop: the target already answers the source, directly or not. */
export function wouldLoop(edges: readonly ArgumentEdge[], sourceId: number, targetId: number): boolean {
  if (sourceId === targetId) return true
  const seen = new Set<number>()
  const stack = [targetId]
  while (stack.length > 0) {
    const at = stack.pop()!
    if (at === sourceId) return true
    if (seen.has(at)) continue
    seen.add(at)
    for (const e of edges) if (e.source_node_id === at) stack.push(e.target_node_id)
  }
  return false
}

export const hasRelation = (edges: readonly ArgumentEdge[], sourceId: number, targetId: number, relation: string): boolean =>
  edges.some((e) => e.source_node_id === sourceId && e.target_node_id === targetId && e.relation_type === relation)

/** Every point connected, in either direction, to the points linked to the finding: the map "for" that finding. */
export function mapOfFinding(nodes: readonly ArgumentNode[], edges: readonly ArgumentEdge[], findingId: number): { nodes: ArgumentNode[]; edges: ArgumentEdge[] } {
  const keep = new Set(nodes.filter((n) => n.finding_id === findingId).map((n) => n.id))
  const queue = [...keep]
  while (queue.length > 0) {
    const at = queue.pop()!
    for (const e of edges) {
      for (const [from, to] of [[e.source_node_id, e.target_node_id], [e.target_node_id, e.source_node_id]] as const) {
        if (from === at && !keep.has(to)) {
          keep.add(to)
          queue.push(to)
        }
      }
    }
  }
  return { nodes: nodes.filter((n) => keep.has(n.id)), edges: edges.filter((e) => keep.has(e.source_node_id) && keep.has(e.target_node_id)) }
}

/** Findings that at least one point is linked to, one entry each, in the order first seen. */
export function linkedFindings(nodes: readonly ArgumentNode[]): { id: number; label: string }[] {
  const seen = new Map<number, string>()
  for (const n of nodes) if (n.finding_id != null && !seen.has(n.finding_id)) seen.set(n.finding_id, (n.finding?.claim ?? '').trim())
  return [...seen].map(([id, label]) => ({ id, label }))
}

/** A point with no source linked is reasoning only; the design says exports show it that way. */
export const isReasoningOnly = (n: Pick<ArgumentNode, 'evidence_id'>): boolean => n.evidence_id == null
