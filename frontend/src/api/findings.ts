import { z } from 'zod'
import { ApiError } from './errors'
import { api } from './http'
import { findingSchema, type FindingStatus } from './schemas/writing'

export interface FindingQuery {
  status?: string
  q?: string
  page?: number
}

export async function listFindings(projectId: number, query: FindingQuery = {}, signal?: AbortSignal) {
  const res = await api(`/projects/${projectId}/findings`, {
    query: { per_page: 100, ...query },
    schema: z.array(findingSchema),
    signal,
  })
  return { items: res.data, pagination: res.pagination }
}

export async function getFinding(projectId: number, id: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/findings/${id}`, { schema: findingSchema, signal })
  return data
}

export interface FindingFields {
  question: string
  claim: string
  reasoning: string
  limitations: string | null
  status: FindingStatus
}

export async function createFinding(projectId: number, fields: FindingFields) {
  const { data } = await api(`/projects/${projectId}/findings`, { method: 'POST', body: fields, schema: findingSchema })
  return data
}

/**
 * Edits a finding. `expected_version` is sent so the server can refuse a stale save, but the server does not count
 * versions today (request file C-18), so every field is also compared with what came back: a change the server
 * accepted and did not keep is reported instead of shown.
 */
export async function updateFinding(projectId: number, id: number, fields: Partial<FindingFields>, expectedVersion?: number | null) {
  const { data } = await api(`/projects/${projectId}/findings/${id}`, {
    method: 'PATCH',
    body: { ...fields, expected_version: expectedVersion ?? undefined },
    schema: findingSchema,
  })
  for (const key of ['question', 'claim', 'reasoning', 'status'] as const) {
    if (fields[key] !== undefined && data[key] !== fields[key]) throw notKept(key)
  }
  if (fields.limitations !== undefined && (data.limitations ?? null) !== (fields.limitations || null)) throw notKept('limitations')
  return data
}

export async function deleteFinding(projectId: number, id: number) {
  await api(`/projects/${projectId}/findings/${id}`, { method: 'DELETE' })
}

function notKept(what: string): ApiError {
  return new ApiError({ status: 200, code: 'NOT_PERSISTED', message: `The server did not keep the ${what}.`, details: { what } })
}
