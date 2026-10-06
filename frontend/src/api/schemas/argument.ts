import { z } from 'zod'

const text = z.string().nullable().optional()

/** The kinds of point the server accepts, in the order the design lists them. */
export const NODE_TYPES = ['premise', 'claim', 'objection', 'reply', 'qualification', 'alternative_conclusion'] as const
export type NodeType = (typeof NODE_TYPES)[number]

/** How one point relates to another: "source <relation> target". The server's fixed list. */
export const RELATIONS = ['supports', 'refutes', 'qualifies', 'replies_to', 'alternative_to'] as const
export type Relation = (typeof RELATIONS)[number]

/**
 * A point of the project's argument map. `evidence` and `finding` are what the server embeds for the linked ids. The
 * server also embeds the creator's whole account; it is not read here (request file C-39).
 */
export const argumentNodeSchema = z.object({
  id: z.number(),
  project_id: z.number().optional(),
  node_type: z.string(),
  title: z.string(),
  content: z.string(),
  evidence_id: z.number().nullable().optional(),
  finding_id: z.number().nullable().optional(),
  order_index: z.number().nullable().optional(),
  created_at: text,
  evidence: z
    .object({ id: z.number(), captured_text: text, locator: text, state: text })
    .passthrough()
    .nullable()
    .optional(),
  finding: z.object({ id: z.number(), claim: text, question: text }).passthrough().nullable().optional(),
  creator: z.object({ id: z.number().nullable().optional(), display_name: text }).nullable().optional(),
})
export type ArgumentNode = z.infer<typeof argumentNodeSchema>

export const argumentEdgeSchema = z.object({
  id: z.number(),
  project_id: z.number().optional(),
  source_node_id: z.number(),
  target_node_id: z.number(),
  relation_type: z.string(),
  notes: text,
})
export type ArgumentEdge = z.infer<typeof argumentEdgeSchema>

/** `cytoscape` repeats the same nodes and edges in another shape; it is not read. */
export const argumentGraphSchema = z.object({
  nodes: z.array(argumentNodeSchema),
  edges: z.array(argumentEdgeSchema),
})
export type ArgumentGraph = z.infer<typeof argumentGraphSchema>
