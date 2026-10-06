import { z } from 'zod'
import { api } from './http'
import {
  findingSchema,
  type FindingItem,
  type FindingStatus,
} from './schemas/findings'

export type { FindingItem, FindingStatus }

export const findingKeys = {
  all: (projectId: number) => ['projects', projectId, 'findings'] as const,
  list: (projectId: number, query?: { status?: string; q?: string }) =>
    ['projects', projectId, 'findings', query] as const,
  detail: (projectId: number, id: number) => ['projects', projectId, 'findings', id] as const,
}

export interface CreateFindingPayload {
  question: string
  claim: string
  reasoning: string
  limitations?: string
  status?: FindingStatus
  evidence_links?: Array<{
    evidence_id: number
    relation_type: 'supporting' | 'opposing' | 'contextual' | 'unresolved'
    interpretation?: string
  }>
}

export interface UpdateFindingPayload {
  question?: string
  claim?: string
  reasoning?: string
  limitations?: string
  status?: FindingStatus
  contributors?: string[]
  expected_version?: number
}

export async function listFindings(
  projectId: number,
  params?: { status?: string; q?: string; per_page?: number },
  signal?: AbortSignal,
) {
  const { data } = await api(`/projects/${projectId}/findings`, {
    query: params,
    schema: z.array(findingSchema),
    signal,
  })
  return data
}

export async function getFinding(projectId: number, id: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/findings/${id}`, {
    schema: findingSchema,
    signal,
  })
  return data
}

export async function createFinding(
  projectId: number,
  payload: CreateFindingPayload,
  signal?: AbortSignal,
) {
  const { data } = await api(`/projects/${projectId}/findings`, {
    method: 'POST',
    body: payload,
    schema: findingSchema,
    signal,
  })
  return data
}

export async function updateFinding(
  projectId: number,
  id: number,
  payload: UpdateFindingPayload,
  signal?: AbortSignal,
) {
  const { data } = await api(`/projects/${projectId}/findings/${id}`, {
    method: 'PATCH',
    body: payload,
    schema: findingSchema,
    signal,
  })
  return data
}

export async function deleteFinding(projectId: number, id: number, signal?: AbortSignal) {
  await api(`/projects/${projectId}/findings/${id}`, {
    method: 'DELETE',
    signal,
  })
}

export async function linkEvidenceToFinding(
  projectId: number,
  id: number,
  payload: {
    evidence_id: number
    relation_type: 'supporting' | 'opposing' | 'contextual' | 'unresolved'
    interpretation?: string
  },
  signal?: AbortSignal,
) {
  const { data } = await api(`/projects/${projectId}/findings/${id}/evidence`, {
    method: 'POST',
    body: payload,
    schema: findingSchema,
    signal,
  })
  return data
}

export async function unlinkEvidenceFromFinding(
  projectId: number,
  id: number,
  evidenceId: number,
  signal?: AbortSignal,
) {
  await api(`/projects/${projectId}/findings/${id}/evidence/${evidenceId}`, {
    method: 'DELETE',
    signal,
  })
}
