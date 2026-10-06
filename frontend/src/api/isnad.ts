import { api } from './http'
import type { AnalysisRun } from './schemas/analyses'
import { topologyAnswerSchema, topologySchema, type Topology } from './schemas/isnad'

/**
 * The transmission graph of the given chains (at least two). Without `save` it only computes; with it the server stores
 * the inputs and the result as the next `isnad_topology` run (editors only).
 */
export async function isnadTopology(projectId: number, sanadIds: readonly number[], save = false, signal?: AbortSignal): Promise<{ topology: Topology; saved: AnalysisRun | null }> {
  const { data } = await api(`/projects/${projectId}/analyses/isnad-topology`, {
    method: 'POST',
    body: { sanad_ids: [...sanadIds], ...(save ? { save_run: true } : {}) },
    schema: topologyAnswerSchema,
    signal,
  })
  return { topology: data.topology, saved: data.saved_run ?? null }
}

/** A stored run's graph, if it has the shape the service makes; otherwise null (it is then shown as stored). */
export function topologyOf(run: Pick<AnalysisRun, 'analysis_type' | 'output_data'>): Topology | null {
  if (run.analysis_type !== 'isnad_topology') return null
  const parsed = topologySchema.safeParse(run.output_data)
  return parsed.success ? parsed.data : null
}
