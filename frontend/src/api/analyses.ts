import { z } from 'zod'
import { api } from './http'
import {
  analysisRunSchema,
  criticismMatrixResultSchema,
  isnadCompareResultSchema,
  matnCompareResultSchema,
  type AnalysisRun,
} from './schemas/analyses'

export type {
  AnalysisRun,
  CriticismMatrixResult,
  IsnadCompareResult,
  MatnCompareResult,
} from './schemas/analyses'

export const analysisKeys = {
  all: (projectId: number) => ['projects', projectId, 'analyses'] as const,
  list: (projectId: number, type?: string) => ['projects', projectId, 'analyses', { type }] as const,
  detail: (projectId: number, id: number) => ['projects', projectId, 'analyses', id] as const,
}

export async function listAnalyses(projectId: number, type?: string, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/analyses`, {
    query: type ? { type } : undefined,
    schema: z.array(analysisRunSchema),
    signal,
  })
  return data
}

export async function getAnalysis(projectId: number, analysisId: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/analyses/${analysisId}`, {
    schema: analysisRunSchema,
    signal,
  })
  return data
}

export interface MatnComparePayload {
  hadith_ids?: number[]
  baseline_id?: number | null
  custom_texts?: Array<{ id?: string; label?: string; text: string }>
  save_run?: boolean
}

export async function runMatnCompare(projectId: number, payload: MatnComparePayload, signal?: AbortSignal) {
  const schema = z.object({
    analysis: matnCompareResultSchema,
    saved_run: analysisRunSchema.nullable().optional(),
  })
  const { data } = await api(`/projects/${projectId}/analyses/matn-compare`, {
    method: 'POST',
    body: payload,
    schema,
    signal,
  })
  return data
}

export interface IsnadComparePayload {
  sanad_ids: number[]
  save_run?: boolean
}

export async function runIsnadCompare(projectId: number, payload: IsnadComparePayload, signal?: AbortSignal) {
  const schema = z.object({
    analysis: isnadCompareResultSchema,
    saved_run: analysisRunSchema.nullable().optional(),
  })
  const { data } = await api(`/projects/${projectId}/analyses/isnad-compare`, {
    method: 'POST',
    body: payload,
    schema,
    signal,
  })
  return data
}

export interface CriticismMatrixPayload {
  narrator_ids: number[]
  scholar_ids?: number[]
  save_run?: boolean
}

export async function runCriticismMatrix(projectId: number, payload: CriticismMatrixPayload, signal?: AbortSignal) {
  const schema = z.object({
    analysis: criticismMatrixResultSchema,
    saved_run: analysisRunSchema.nullable().optional(),
  })
  const { data } = await api(`/projects/${projectId}/analyses/criticism-matrix`, {
    method: 'POST',
    body: payload,
    schema,
    signal,
  })
  return data
}

export interface SaveAnalysisPayload {
  analysis_type: 'matn_comparison' | 'isnad_comparison' | 'narrator_dossier' | 'criticism_matrix' | 'ilal_case'
  input_params: Record<string, unknown>
  output_data: Record<string, unknown>
}

export async function saveAnalysis(projectId: number, payload: SaveAnalysisPayload, signal?: AbortSignal): Promise<AnalysisRun> {
  const { data } = await api(`/projects/${projectId}/analyses/save`, {
    method: 'POST',
    body: payload,
    schema: analysisRunSchema,
    signal,
  })
  return data
}
