import { z } from 'zod'
import { api } from './http'
import { analysisRunSchema, criticismMatrixResultSchema, isnadCompareResultSchema, matnCompareResultSchema, type AnalysisRun } from './schemas/analyses'

export type { CriticismMatrixResult, IsnadCompareResult, MatnCompareResult } from './schemas/analyses'

export async function listAnalyses(projectId: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/analyses`, { schema: z.array(analysisRunSchema), signal })
  return data
}

export async function getAnalysis(projectId: number, analysisId: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/analyses/${analysisId}`, { schema: analysisRunSchema, signal })
  return data
}

/**
 * The three comparisons. Without `save` they only compute (nothing is stored, any member may run them); with `save`
 * the server stores the inputs and the result as the next version of that kind of analysis in the project.
 */
async function post<S extends z.ZodType>(
  projectId: number,
  kind: string,
  result: S,
  body: Record<string, unknown>,
  save: boolean,
  signal?: AbortSignal,
) {
  const { data } = await api(`/projects/${projectId}/analyses/${kind}`, {
    method: 'POST',
    body: save ? { ...body, save_run: true } : body,
    schema: z.object({ analysis: result, saved_run: analysisRunSchema.nullable().optional() }),
    signal,
  })
  const answer = data as { analysis: z.infer<S>; saved_run?: AnalysisRun | null }
  return { result: answer.analysis, saved: answer.saved_run ?? null }
}

export interface MatnInputs {
  hadith_ids: number[]
  baseline_id?: number
}
export const compareMatn = (projectId: number, inputs: MatnInputs, save = false, signal?: AbortSignal) =>
  post(projectId, 'matn-compare', matnCompareResultSchema, { ...inputs }, save, signal)

export const compareIsnads = (projectId: number, sanadIds: number[], save = false, signal?: AbortSignal) =>
  post(projectId, 'isnad-compare', isnadCompareResultSchema, { sanad_ids: sanadIds }, save, signal)

export const criticismMatrix = (projectId: number, narratorIds: number[], save = false, signal?: AbortSignal) =>
  post(projectId, 'criticism-matrix', criticismMatrixResultSchema, { narrator_ids: narratorIds }, save, signal)
