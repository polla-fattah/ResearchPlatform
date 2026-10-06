import type { IsnadChain } from '@/api/schemas/analyses'
import type { Topology, TopologyEdge, TopologyNode } from '@/api/schemas/isnad'

export type NodeRole = 'start' | 'end' | 'passes' | 'candidate'

/** One narrator as the screen lists and draws them: who, how many chains pass through, and who they link to. */
export interface NarratorRow {
  id: string
  name: string
  /** How many of the compared chains pass through this narrator. */
  chains: number
  teachers: { id: string; name: string; chains: number }[]
  students: { id: string; name: string; chains: number }[]
  role: NodeRole
  /** Whether the server's rule picked this narrator (branching into two or more, or on most chains). */
  candidate: boolean
  numericId: number | null
}

export const idKey = (id: number | string) => String(id)
export const numeric = (id: string): number | null => (/^\d+$/.test(id) ? Number(id) : null)

/**
 * The narrators of a graph, ready to list. The server's "common link" rule (a narrator with two or more students in the
 * chains, or on at least 70% of them) marks `candidate`; nothing here says it is proved. A narrator with no teacher in the
 * chains is where the chains begin, one with no student is where they end.
 */
export function narratorRows(topology: Topology): NarratorRow[] {
  const { nodes, edges } = topology.graph_topology
  const byId = new Map(nodes.map((n) => [idKey(n.id), n]))
  const candidates = new Set([topology.madar_al_isnad, ...(topology.partial_common_links ?? [])].filter(Boolean).map((c) => idKey(c!.narrator_id)))
  const nameOf = (id: string) => byId.get(id)?.name ?? id

  const rows = nodes.map((node): NarratorRow => {
    const id = idKey(node.id)
    const teachers = edges.filter((e) => idKey(e.target) === id).map((e) => ({ id: idKey(e.source), name: nameOf(idKey(e.source)), chains: e.weight }))
    const students = edges.filter((e) => idKey(e.source) === id).map((e) => ({ id: idKey(e.target), name: nameOf(idKey(e.target)), chains: e.weight }))
    const candidate = candidates.has(id)
    const role: NodeRole = candidate ? 'candidate' : teachers.length === 0 ? 'start' : students.length === 0 ? 'end' : 'passes'
    return { id, name: node.name, chains: node.frequency, teachers, students, role, candidate, numericId: numeric(id) }
  })
  return rows.sort((a, b) => Number(b.candidate) - Number(a.candidate) || b.chains - a.chains || a.name.localeCompare(b.name))
}

/** The chains that pass through a narrator, from the comparison's chain list (which names each chain's narrators in order). */
export function chainsThrough(chains: readonly IsnadChain[], narratorId: number | null): IsnadChain[] {
  return narratorId === null ? [...chains] : chains.filter((c) => c.narrators.some((n) => n.narrator_id === narratorId))
}

// ── Layout ────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Placed {
  id: string
  layer: number
  slot: number
}

/**
 * Puts each narrator in a column by generation: the earliest transmitters first, each narrator one column after the
 * latest of their teachers. A link that would close a loop (the data is not guaranteed to be acyclic) is ignored for the
 * placement, so the layout always ends. Within a column narrators are ordered by name, then spread by their slot.
 */
export function layoutLayers(nodes: readonly Pick<TopologyNode, 'id' | 'name'>[], edges: readonly Pick<TopologyEdge, 'source' | 'target'>[]): Placed[] {
  const ids = nodes.map((n) => idKey(n.id))
  const name = new Map(nodes.map((n) => [idKey(n.id), n.name]))
  const teachers = new Map<string, string[]>(ids.map((id) => [id, []]))
  for (const e of edges) {
    const s = idKey(e.source)
    const t = idKey(e.target)
    if (s !== t && teachers.has(s) && teachers.has(t)) teachers.get(t)!.push(s)
  }
  const layer = new Map<string, number>()
  const visiting = new Set<string>()
  const depth = (id: string): number => {
    const known = layer.get(id)
    if (known !== undefined) return known
    if (visiting.has(id)) return 0 // a loop: stop here
    visiting.add(id)
    const d = teachers.get(id)!.reduce((m, s) => Math.max(m, depth(s) + 1), 0)
    visiting.delete(id)
    layer.set(id, d)
    return d
  }
  ids.forEach(depth)
  const columns = new Map<number, string[]>()
  for (const id of ids) columns.set(layer.get(id)!, [...(columns.get(layer.get(id)!) ?? []), id])
  const placed: Placed[] = []
  for (const [l, members] of [...columns.entries()].sort((a, b) => a[0] - b[0])) {
    members.sort((a, b) => (name.get(a) ?? '').localeCompare(name.get(b) ?? '') || a.localeCompare(b))
    members.forEach((id, slot) => placed.push({ id, layer: l, slot }))
  }
  return placed
}

/** The generation count of a layout: how many columns it has. */
export const generationCount = (placed: readonly Placed[]) => placed.reduce((m, p) => Math.max(m, p.layer + 1), 0)
