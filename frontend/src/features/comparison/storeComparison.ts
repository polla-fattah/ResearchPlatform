import { compareIsnads, compareMatn, criticismMatrix } from '@/api/analyses'
import type { RunInputs } from './comparisonModel'

/** Stores a comparison: the server runs it again from these inputs and keeps inputs and result as the next version. */
export async function storeComparison(projectId: number, inputs: RunInputs, baseline?: number) {
  const stored =
    inputs.kind === 'matn'
      ? await compareMatn(projectId, { hadith_ids: inputs.hadithIds, ...(baseline ? { baseline_id: baseline } : {}) }, true)
      : inputs.kind === 'isnads'
        ? await compareIsnads(projectId, inputs.sanadIds, true)
        : await criticismMatrix(projectId, inputs.narratorIds, true)
  return { saved: stored.saved }
}
