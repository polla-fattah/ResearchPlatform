import { z } from 'zod'
import { ApiError } from './errors'
import { api } from './http'
import {
  annotationSchema,
  dependenciesSchema,
  evidenceDetailSchema,
  evidenceItemSchema,
  findingOptionSchema,
  hasDependenciesSchema,
  historySchema,
  type Relation,
} from './schemas/evidence'

export interface EvidenceQuery {
  state?: string
  q?: string
  page?: number
  per_page?: number
}

export const evidenceKeys = {
  all: (projectId: number) => ['project', projectId, 'evidence'] as const,
  list: (projectId: number, q: EvidenceQuery) => ['project', projectId, 'evidence', 'list', q] as const,
  item: (projectId: number, id: number) => ['project', projectId, 'evidence', 'item', id] as const,
  history: (projectId: number, id: number) => ['project', projectId, 'evidence', 'history', id] as const,
  deps: (projectId: number, id: number) => ['project', projectId, 'evidence', 'deps', id] as const,
  findings: (projectId: number) => ['project', projectId, 'evidence', 'findings'] as const,
}

export async function listEvidence(projectId: number, query: EvidenceQuery, signal?: AbortSignal) {
  const res = await api(`/projects/${projectId}/evidence`, {
    query: { ...query },
    schema: z.array(evidenceItemSchema),
    signal,
  })
  return { items: res.data, pagination: res.pagination }
}

export async function getEvidence(projectId: number, id: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/evidence/${id}`, { schema: evidenceDetailSchema, signal })
  return data
}

/**
 * Changes the state. The reason travels as `state_reason`; excluded and unresolved always need one.
 * The answer is compared with what was asked, so a state the server did not keep is reported, not shown.
 */
export async function setEvidenceState(projectId: number, id: number, state: string, reason: string | null) {
  const { data } = await api(`/projects/${projectId}/evidence/${id}`, {
    method: 'PATCH',
    body: { state, state_reason: reason },
    schema: evidenceItemSchema,
  })
  if (data.state !== state) {
    throw new ApiError({ status: 200, code: 'NOT_PERSISTED', message: 'The server did not keep the new state.', details: { what: 'state' } })
  }
  return data
}

export type RemoveOutcome = { kind: 'removed' } | { kind: 'in-use'; findings: number; citations: number; findingTitles: string[] }

/** Without `confirm` the API refuses (409 HAS_DEPENDENCIES) when findings or documents still use the item. */
export async function removeEvidence(projectId: number, id: number, confirm: boolean): Promise<RemoveOutcome> {
  try {
    await api(`/projects/${projectId}/evidence/${id}`, { method: 'DELETE', query: confirm ? { confirm: true } : {} })
    return { kind: 'removed' }
  } catch (err) {
    if (err instanceof ApiError && err.status === 409 && err.code === 'HAS_DEPENDENCIES') {
      const d = hasDependenciesSchema.safeParse(err.details)
      return {
        kind: 'in-use',
        findings: d.success ? (d.data.findings_count ?? 0) : 0,
        citations: d.success ? (d.data.citations_count ?? 0) : 0,
        findingTitles: d.success ? (d.data.dependent_findings ?? []).map((f) => f.claim) : [],
      }
    }
    throw err
  }
}

export async function getHistory(projectId: number, id: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/evidence/${id}/history`, { schema: historySchema, signal })
  return data
}

export async function getDependencies(projectId: number, id: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/evidence/${id}/dependencies`, { schema: dependenciesSchema, signal })
  return data
}

export interface AnnotationInput {
  annotation_kind: string
  body: string
  visibility: 'private' | 'project_shared'
  attributed_to?: string
  source_locator?: string
}

export async function addAnnotation(projectId: number, id: number, input: AnnotationInput) {
  const { data } = await api(`/projects/${projectId}/evidence/${id}/annotations`, {
    method: 'POST',
    body: input,
    schema: annotationSchema,
  })
  return data
}

/** Promote a private annotation to the project, or take it back. */
export async function setAnnotationVisibility(projectId: number, id: number, annotationId: number, visibility: 'private' | 'project_shared') {
  const { data } = await api(`/projects/${projectId}/evidence/${id}/annotations/${annotationId}`, {
    method: 'PATCH',
    body: { visibility },
    schema: annotationSchema,
  })
  if (data.visibility !== visibility) {
    throw new ApiError({ status: 200, code: 'NOT_PERSISTED', message: 'The server did not keep the visibility.', details: { what: 'visibility' } })
  }
  return data
}

export async function deleteAnnotation(projectId: number, id: number, annotationId: number) {
  await api(`/projects/${projectId}/evidence/${id}/annotations/${annotationId}`, { method: 'DELETE' })
}

export async function listFindingOptions(projectId: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/findings`, {
    query: { per_page: 100 },
    schema: z.array(findingOptionSchema),
    signal,
  })
  return data
}

export async function linkFinding(projectId: number, findingId: number, evidenceId: number, relation: Relation, interpretation?: string) {
  await api(`/projects/${projectId}/findings/${findingId}/evidence`, {
    method: 'POST',
    body: { evidence_id: evidenceId, relation_type: relation, interpretation: interpretation || undefined },
  })
}

export async function unlinkFinding(projectId: number, findingId: number, evidenceId: number) {
  await api(`/projects/${projectId}/findings/${findingId}/evidence/${evidenceId}`, { method: 'DELETE' })
}

export interface CorrectionInput {
  corpus_table: 'hadiths' | 'narrators' | 'books' | 'sanads'
  corpus_id: number
  current_value: string
  proposed_value: string
  evidence_notes: string
  evidence_id: number
}

export async function proposeCorrection(input: CorrectionInput) {
  const { data } = await api('/corpus/proposals', {
    method: 'POST',
    body: input,
    schema: z.object({ id: z.number(), status: z.string() }),
  })
  return data
}
