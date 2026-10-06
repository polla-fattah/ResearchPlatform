import { api } from './http'
import { collateAnswerSchema, collationSchema, type Collation } from './schemas/alignment'
import type { AnalysisRun } from './schemas/analyses'

export interface CollateInput {
  baseline_text: string
  variants: { id: number; label: string; text: string }[]
}

/**
 * Aligns each variant against the baseline, word by word. Without `save` it only computes (nothing is stored); with it
 * the server stores the inputs and the result as the next `sequence_collation` run (editors only).
 */
export async function collate(projectId: number, input: CollateInput, save = false, signal?: AbortSignal): Promise<{ collation: Collation; saved: AnalysisRun | null }> {
  const { data } = await api(`/projects/${projectId}/analyses/collate`, {
    method: 'POST',
    body: save ? { ...input, save_run: true } : input,
    schema: collateAnswerSchema,
    signal,
  })
  return { collation: data.collation, saved: data.saved_run ?? null }
}

/** A stored run's output, if it has the shape the service makes; otherwise null (it is then shown as stored). */
export function collationOf(run: Pick<AnalysisRun, 'analysis_type' | 'output_data'>): Collation | null {
  if (run.analysis_type !== 'sequence_collation') return null
  const parsed = collationSchema.safeParse(run.output_data)
  return parsed.success ? parsed.data : null
}
