import { z } from 'zod'
import { saveBlob } from './exports'
import { api } from './http'

const node = z.object({ data: z.object({ id: z.string(), label: z.string().nullable().optional(), type: z.string().nullable().optional(), content: z.string().nullable().optional() }).passthrough() })
const edge = z.object({ data: z.object({ id: z.string(), source: z.string(), target: z.string(), relation: z.string().nullable().optional() }).passthrough() })

/**
 * `GET /projects/{id}/exports/graph`: the argument map as a Cytoscape-style dataset. It carries each point's title, kind
 * and text and each relation's kind. It does not carry the evidence or finding a point is linked to, notes on relations,
 * order, authors or removed points, and it ignores the `format` it is given (so no GraphML), see request file C-42.
 */
export const graphExportSchema = z.object({
  project_id: z.number(),
  format: z.string().optional(),
  graph: z.object({ nodes: z.array(node), edges: z.array(edge) }),
  summary: z.object({ total_nodes: z.number(), total_edges: z.number() }),
})
export type GraphExport = z.infer<typeof graphExportSchema>

export async function fetchGraphExport(projectId: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/exports/graph`, { schema: graphExportSchema, signal })
  return data
}

/** The file as it is saved: the dataset only, as pretty JSON (the server's reply wraps it in a message envelope). */
export function graphFile(data: GraphExport): Blob {
  return new Blob([JSON.stringify({ project_id: data.project_id, graph: data.graph, summary: data.summary }, null, 2)], { type: 'application/json;charset=utf-8' })
}

/** Fetches the dataset and saves it; returns what was saved so the screen can say how many points and relations it holds. */
export async function exportArgumentGraph(projectId: number, fileName: string): Promise<GraphExport> {
  const data = await fetchGraphExport(projectId)
  saveBlob(graphFile(data), fileName)
  return data
}
