import { z } from 'zod'
import { analysisRunSchema } from './analyses'

const nodeId = z.union([z.number(), z.string()])

/**
 * The server's transmission graph. Narrators are nodes and "teacher to student" links are edges, with how many chains
 * pass through each. The answer also holds a block called `formal_proof` ("Topological Convergence Theorem",
 * "verified_common_link") and a copy of the graph in another library's format; neither is named here, so neither can be
 * shown (a rule of thumb is not a proof: request file C-34).
 */
export const topologyNodeSchema = z.object({
  id: nodeId,
  name: z.string(),
  tabaqah: z.unknown().nullable().optional(),
  rutba: z.unknown().nullable().optional(),
  death_year: z.unknown().nullable().optional(),
  in_degree: z.number().optional().default(0),
  out_degree: z.number().optional().default(0),
  frequency: z.number().optional().default(0),
  role: z.string().nullable().optional(),
})
export type TopologyNode = z.infer<typeof topologyNodeSchema>

export const topologyEdgeSchema = z.object({ source: nodeId, target: nodeId, weight: z.number().optional().default(1) })
export type TopologyEdge = z.infer<typeof topologyEdgeSchema>

export const candidateSchema = z.object({
  narrator_id: nodeId,
  name: z.string(),
  out_degree: z.number().optional(),
  in_degree: z.number().optional(),
  chain_coverage: z.number().optional(),
})
export type Candidate = z.infer<typeof candidateSchema>

export const topologySchema = z.object({
  total_sanads_analyzed: z.number().optional(),
  total_unique_narrators: z.number().optional(),
  total_transmission_edges: z.number().optional(),
  madar_al_isnad: candidateSchema.nullable().optional(),
  partial_common_links: z.array(candidateSchema).nullable().optional(),
  graph_topology: z.object({ nodes: z.array(topologyNodeSchema), edges: z.array(topologyEdgeSchema) }),
})
export type Topology = z.infer<typeof topologySchema>

export const topologyAnswerSchema = z.object({ topology: topologySchema, saved_run: analysisRunSchema.nullable().optional() })
