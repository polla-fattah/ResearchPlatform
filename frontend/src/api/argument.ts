import { ApiError } from './errors'
import { api } from './http'
import { argumentEdgeSchema, argumentGraphSchema, argumentNodeSchema, type NodeType, type Relation } from './schemas/argument'

const notKept = (what: string) =>
  new ApiError({ status: 200, code: 'NOT_PERSISTED', message: `The server did not keep the ${what}.`, details: { what } })

export async function getGraph(projectId: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/argument-graph`, { schema: argumentGraphSchema, signal })
  return data
}

export interface NodeFields {
  node_type: NodeType
  title: string
  content: string
  evidence_id?: number
  finding_id?: number
  order_index?: number
}

export async function createNode(projectId: number, fields: NodeFields) {
  const { data } = await api(`/projects/${projectId}/argument-nodes`, { method: 'POST', body: fields, schema: argumentNodeSchema })
  if (data.title !== fields.title) throw notKept('point')
  if (fields.evidence_id !== undefined && data.evidence_id !== fields.evidence_id) throw notKept('source link')
  return data
}

/**
 * The server ignores empty values on update, so a linked source or finding can be changed to another but not removed
 * (request file C-39). The type, title and text can always be changed.
 */
export async function updateNode(projectId: number, nodeId: number, fields: Partial<NodeFields>) {
  const { data } = await api(`/projects/${projectId}/argument-nodes/${nodeId}`, { method: 'PATCH', body: fields, schema: argumentNodeSchema })
  if (fields.title !== undefined && data.title !== fields.title) throw notKept('title')
  if (fields.content !== undefined && data.content !== fields.content) throw notKept('text')
  if (fields.node_type !== undefined && data.node_type !== fields.node_type) throw notKept('type')
  if (fields.evidence_id !== undefined && data.evidence_id !== fields.evidence_id) throw notKept('source link')
  return data
}

export async function deleteNode(projectId: number, nodeId: number) {
  await api(`/projects/${projectId}/argument-nodes/${nodeId}`, { method: 'DELETE' })
}

export async function createEdge(projectId: number, input: { source_node_id: number; target_node_id: number; relation_type: Relation; notes?: string }) {
  const { data } = await api(`/projects/${projectId}/argument-edges`, { method: 'POST', body: input, schema: argumentEdgeSchema })
  if (data.source_node_id !== input.source_node_id || data.target_node_id !== input.target_node_id) throw notKept('relation')
  return data
}

export async function deleteEdge(projectId: number, edgeId: number) {
  await api(`/projects/${projectId}/argument-edges/${edgeId}`, { method: 'DELETE' })
}
