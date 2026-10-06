import { z } from 'zod'
import { api } from './http'
import {
  bulkOutcomeSchema,
  compareSchema,
  hukmSchema,
  resultSetSchema,
  runResultSchema,
  runWithQuerySchema,
  savedQuerySchema,
  type SearchFilters,
} from './schemas/search'

export const searchKeys = {
  all: (projectId: number) => ['project', projectId, 'search'] as const,
  queries: (projectId: number) => ['project', projectId, 'search', 'queries'] as const,
  runs: (projectId: number) => ['project', projectId, 'search', 'runs'] as const,
  resultSets: (projectId: number) => ['project', projectId, 'search', 'result-sets'] as const,
  compare: (projectId: number, a: number, b: number) =>
    ['project', projectId, 'search', 'compare', a, b] as const,
  hukms: ['corpus', 'hukms'] as const,
  personal: ['saved-searches'] as const,
}

export interface QueryDefinition {
  name: string
  query_text: string
  search_mode: 'exact' | 'normalized'
  filter_criteria: SearchFilters
}

export async function listSavedQueries(projectId: number, signal?: AbortSignal) {
  const res = await api(`/projects/${projectId}/searches`, {
    query: { per_page: 100 },
    schema: z.array(savedQuerySchema),
    signal,
  })
  return res.data
}

export async function createSavedQuery(projectId: number, def: QueryDefinition) {
  const { data } = await api(`/projects/${projectId}/searches`, {
    method: 'POST',
    body: def,
    schema: savedQuerySchema,
  })
  return data
}

export async function deleteSavedQuery(projectId: number, id: number) {
  await api(`/projects/${projectId}/searches/${id}`, { method: 'DELETE' })
}

/** Records a run. The backend executes it synchronously and stores the hit list. */
export async function runSavedQuery(projectId: number, id: number) {
  const { data } = await api(`/projects/${projectId}/searches/${id}/run`, {
    method: 'POST',
    schema: runResultSchema,
  })
  return data.search_run
}

export async function listRuns(projectId: number, signal?: AbortSignal) {
  const res = await api(`/projects/${projectId}/search-runs`, {
    query: { per_page: 100 },
    schema: z.array(runWithQuerySchema),
    signal,
  })
  return res.data
}

export async function compareRuns(projectId: number, a: number, b: number) {
  const { data } = await api(`/projects/${projectId}/search-runs/compare`, {
    method: 'POST',
    body: { run_id_1: a, run_id_2: b },
    schema: compareSchema,
  })
  return data.summary
}

export async function listResultSets(projectId: number, signal?: AbortSignal) {
  const res = await api(`/projects/${projectId}/result-sets`, {
    query: { per_page: 100 },
    schema: z.array(resultSetSchema),
    signal,
  })
  return res.data
}

export interface ResultSetItem {
  resource_type: string
  corpus_id: number
  snapshot_data?: Record<string, unknown>
}

export async function createResultSet(
  projectId: number,
  input: { name: string; items: ResultSetItem[] } | { name: string; search_run_id: number; select: 'all' },
) {
  const { data } = await api(`/projects/${projectId}/result-sets`, {
    method: 'POST',
    body: input,
    schema: resultSetSchema,
  })
  return data
}

export async function bulkAddResources(projectId: number, resourceIds: number[], runId?: number) {
  const { data } = await api(`/projects/${projectId}/resources/bulk`, {
    method: 'POST',
    body: { resource_ids: resourceIds, run_id: runId },
    schema: bulkOutcomeSchema,
  })
  return data
}

export interface EvidenceDraft {
  resource_id: number
  captured_text: string
  locator?: string
}

export async function bulkAddEvidence(projectId: number, items: EvidenceDraft[], runId?: number) {
  const { data } = await api(`/projects/${projectId}/evidence/bulk`, {
    method: 'POST',
    body: { items, run_id: runId },
    schema: bulkOutcomeSchema,
  })
  return data
}

export async function listHukms(signal?: AbortSignal) {
  const { data } = await api('/corpus/hukms', { schema: z.array(hukmSchema), signal })
  return data
}
