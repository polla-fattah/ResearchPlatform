import { z } from 'zod'
import { ApiError } from './errors'
import { api } from './http'
import { assignmentSchema, type Recommendation } from './schemas/review'

const notKept = (what: string) =>
  new ApiError({ status: 200, code: 'NOT_PERSISTED', message: `The server did not keep the ${what}.`, details: { what } })

export async function listAssignments(signal?: AbortSignal) {
  const { data } = await api('/reviews/assignments', { schema: z.array(assignmentSchema), signal })
  return data
}

export async function getAssignment(id: number, signal?: AbortSignal) {
  const { data } = await api(`/reviews/assignments/${id}`, { schema: assignmentSchema, signal })
  return data
}

/**
 * The reviewer's declaration of no conflict, then acceptance. The server keeps only a yes/no (a conflict is declined
 * instead: declining deletes the assignment), so a declaration of "no conflict" is all this sends.
 */
export async function declareNoConflict(id: number) {
  const { data } = await api(`/reviews/assignments/${id}/coi-declaration`, { method: 'POST', body: { coi_confirmed: true }, schema: assignmentSchema })
  if (data.coi_confirmed !== true) throw notKept('declaration')
}

export async function acceptAssignment(id: number) {
  await api(`/reviews/assignments/${id}/accept`, { method: 'POST' })
}

export async function declineAssignment(id: number) {
  await api(`/reviews/assignments/${id}/decline`, { method: 'POST' })
}

export interface ReviewInput {
  recommendation: Recommendation
  score?: number
  reviewer_notes: string
}

/** Submits the review. The declaration is sent with it, as the server asks; the answer is checked against what was sent. */
export async function submitReview(id: number, input: ReviewInput) {
  const { data } = await api(`/reviews/assignments/${id}/recommendation`, {
    method: 'POST',
    body: { recommendation: input.recommendation, score: input.score, reviewer_notes: input.reviewer_notes, coi_confirmed: true },
    schema: assignmentSchema,
  })
  if (data.recommendation !== input.recommendation) throw notKept('recommendation')
  if (!data.completed_at) throw notKept('review')
  return data
}
