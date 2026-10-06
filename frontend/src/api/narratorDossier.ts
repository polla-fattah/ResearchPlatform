import { z } from 'zod'
import { ApiError } from './errors'
import { api } from './http'
import {
  assertionSchema,
  assessmentSchema,
  trajectorySchema,
  type Alternative,
  type AssessmentCategory,
  type UncertaintyLevel,
} from './schemas/narratorDossier'

const notKept = (what: string) =>
  new ApiError({ status: 200, code: 'NOT_PERSISTED', message: `The server did not keep the ${what}.`, details: { what } })

/**
 * The project's assertions about ONE narrator. The server filters by `subject_type` only (not by `subject_id`), so the
 * narrator is picked out here; for a project with very many assertions that is a lot to fetch (request file C-37).
 */
export async function listAssertions(projectId: number, narratorId: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/assertions`, { query: { subject_type: 'narrator' }, schema: z.array(assertionSchema), signal })
  return data.filter((a) => a.subject_id === narratorId)
}

export interface NewAssertion {
  subject_id: number
  subject_name: string
  assertion_claim: string
  uncertainty_level: UncertaintyLevel
  competing_alternatives?: Alternative[]
  adjudication_notes?: string
}

export async function createAssertion(projectId: number, input: NewAssertion) {
  const { data } = await api(`/projects/${projectId}/assertions`, { method: 'POST', body: { subject_type: 'narrator', ...input }, schema: assertionSchema })
  if (data.assertion_claim !== input.assertion_claim) throw notKept('claim')
  if (data.subject_id !== input.subject_id) throw notKept('narrator it is about')
  return data
}

export interface AssertionPatch {
  assertion_claim?: string
  uncertainty_level?: UncertaintyLevel
  competing_alternatives?: Alternative[]
  adjudication_notes?: string
}

/** The server ignores empty values on update (it drops nulls), so a field cannot be cleared; the screen says so. */
export async function updateAssertion(projectId: number, id: number, patch: AssertionPatch) {
  const { data } = await api(`/projects/${projectId}/assertions/${id}`, { method: 'PATCH', body: patch, schema: assertionSchema })
  if (patch.assertion_claim !== undefined && data.assertion_claim !== patch.assertion_claim) throw notKept('claim')
  if (patch.uncertainty_level !== undefined && data.uncertainty_level !== patch.uncertainty_level) throw notKept('level of certainty')
  if (patch.competing_alternatives && data.competing_alternatives.length !== patch.competing_alternatives.length) throw notKept('alternatives')
  return data
}

export async function deleteAssertion(projectId: number, id: number) {
  await api(`/projects/${projectId}/assertions/${id}`, { method: 'DELETE' })
}

export async function listAssessments(projectId: number, narratorId: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/narrator-assessments`, { query: { narrator_id: narratorId }, schema: z.array(assessmentSchema), signal })
  return data
}

export interface NewAssessment {
  narrator_id: number
  teacher_id: number
  assessment_category: AssessmentCategory
  critic_name?: string
  qawl_text: string
}

export async function createAssessment(projectId: number, input: NewAssessment) {
  const { data } = await api(`/projects/${projectId}/narrator-assessments`, { method: 'POST', body: { ...input, critic_name: input.critic_name || undefined }, schema: assessmentSchema })
  if (data.qawl_text !== input.qawl_text) throw notKept('assessment text')
  if (data.teacher_id !== input.teacher_id) throw notKept('teacher it applies to')
  return data
}

/** Where the corpus and the research community place the narrator in life. Shared data, read only (see C-37). */
export async function getTrajectory(narratorId: number, signal?: AbortSignal) {
  const { data } = await api(`/geospatial/narrators/${narratorId}/trajectory`, { schema: trajectorySchema, signal })
  return data
}
