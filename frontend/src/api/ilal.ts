import { z } from 'zod'
import { ApiError } from './errors'
import { api } from './http'
import { ilalCaseSchema, type CaseStatus, type Critic, type Discrepancy, type Variant } from './schemas/ilal'

const notKept = (what: string) =>
  new ApiError({ status: 200, code: 'NOT_PERSISTED', message: `The server did not keep the ${what}.`, details: { what } })

export async function listCases(projectId: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/ilal-cases`, { schema: z.array(ilalCaseSchema), signal })
  return data
}

export async function getCase(projectId: number, caseId: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/ilal-cases/${caseId}`, { schema: ilalCaseSchema, signal })
  return data
}

export interface NewCase {
  title: string
  discrepancy_category: Discrepancy
  competing_variants?: Variant[]
  critics_judgments?: Critic[]
}

export async function createCase(projectId: number, input: NewCase) {
  const { data } = await api(`/projects/${projectId}/ilal-cases`, { method: 'POST', body: input, schema: ilalCaseSchema })
  if (data.title !== input.title) throw notKept('title')
  if (data.status !== 'under_investigation') throw notKept('status')
  return data
}

export interface CasePatch {
  title?: string
  status?: CaseStatus
  preferred_version?: string
  resolution_notes?: string
  competing_variants?: Variant[]
  critics_judgments?: Critic[]
}

/** The server replaces whole lists, so a list is always sent from a fresh read (see `appendToCase`). */
export async function updateCase(projectId: number, caseId: number, patch: CasePatch) {
  const { data } = await api(`/projects/${projectId}/ilal-cases/${caseId}`, { method: 'PATCH', body: patch, schema: ilalCaseSchema })
  if (patch.status !== undefined && data.status !== patch.status) throw notKept('status')
  if (patch.preferred_version !== undefined && (data.preferred_version ?? '') !== patch.preferred_version) throw notKept('preferred version')
  if (patch.resolution_notes !== undefined && (data.resolution_notes ?? '') !== patch.resolution_notes) throw notKept('notes')
  if (patch.competing_variants && data.competing_variants.length !== patch.competing_variants.length) throw notKept('versions')
  if (patch.critics_judgments && data.critics_judgments.length !== patch.critics_judgments.length) throw notKept('critic statements')
  return data
}

/**
 * Adds one version or one critic statement. The server has no "append": it replaces the list. So the case is read again
 * just before writing and the new entry goes on the end of what is there NOW, which keeps what a teammate added a moment
 * ago. A tiny window remains between the read and the write (no version check on the server, request file C-36).
 */
export async function appendToCase(projectId: number, caseId: number, entry: { variant: Variant } | { critic: Critic }) {
  const fresh = await getCase(projectId, caseId)
  return updateCase(
    projectId,
    caseId,
    'variant' in entry ? { competing_variants: [...fresh.competing_variants, entry.variant] } : { critics_judgments: [...fresh.critics_judgments, entry.critic] },
  )
}
