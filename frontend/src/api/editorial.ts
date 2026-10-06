import { z } from 'zod'
import { ApiError } from './errors'
import { api } from './http'
import {
  candidateSchema,
  decisionResultSchema,
  editorReviewSchema,
  editorSubmissionSchema,
  publicationRefSchema,
  type Decision,
  type QueueStage,
} from './schemas/editorial'

const notKept = (what: string) =>
  new ApiError({ status: 200, code: 'NOT_PERSISTED', message: `The server did not keep the ${what}.`, details: { what } })

export const QUEUE_PER_PAGE = 20

export interface QueueQuery {
  stage?: QueueStage
  action_required?: 'assign_reviewer' | 'submit_review' | 'editor_decision' | 'release'
  q?: string
  page?: number
}

export async function listQueue(query: QueueQuery = {}, signal?: AbortSignal) {
  const res = await api('/editor/submissions', { query: { ...query, per_page: QUEUE_PER_PAGE }, schema: z.array(editorSubmissionSchema), signal })
  return { items: res.data, pagination: res.pagination }
}

export async function getEditorSubmission(id: number, signal?: AbortSignal) {
  const { data } = await api(`/editor/submissions/${id}`, { schema: editorSubmissionSchema, signal })
  return data
}

export async function listReviewerCandidates(id: number, signal?: AbortSignal) {
  const { data } = await api(`/editor/submissions/${id}/reviewer-candidates`, { schema: z.array(candidateSchema), signal })
  return data
}

/** The editor states that they know of no conflict; that is sent only when it has been confirmed on the screen. */
export async function assignReviewer(id: number, input: { reviewer_id: number; due_date?: string }) {
  const { data } = await api(`/editor/submissions/${id}/assign`, {
    method: 'POST',
    body: { reviewer_id: input.reviewer_id, due_date: input.due_date || undefined, coi_confirmed: true },
    schema: editorReviewSchema,
  })
  if (data.reviewer_id !== input.reviewer_id) throw notKept('reviewer')
  return data
}

/** `override_peer_review` is never sent: approving without a finished review is not something this screen offers. */
export async function decideSubmission(id: number, input: { decision: Decision; decision_notes: string }) {
  const { data } = await api(`/editor/submissions/${id}/decision`, {
    method: 'POST',
    body: { decision: input.decision, decision_notes: input.decision_notes, coi_confirmed: true },
    schema: decisionResultSchema,
  })
  const expected = { approve: 'approved', request_revisions: 'revision_requested', reject: 'rejected' }[input.decision]
  if (data.submission_status !== expected) throw notKept('decision')
  return data
}

export interface ReleaseInput {
  public_slug: string
  version_string?: string
  doi?: string
  license?: string
}

export async function releasePublication(id: number, input: ReleaseInput) {
  const { data } = await api(`/editor/submissions/${id}/release`, {
    method: 'POST',
    body: { public_slug: input.public_slug, version_string: input.version_string || undefined, doi: input.doi || undefined, license: input.license || undefined },
    schema: publicationRefSchema,
  })
  if (data.status !== 'published') throw notKept('release')
  return data
}

export async function addCorrigendum(publicationId: number, input: { notice: string; new_version_string: string }) {
  const { data } = await api(`/editor/publications/${publicationId}/corrigenda`, { method: 'POST', body: input, schema: publicationRefSchema })
  if (data.version_string !== input.new_version_string) throw notKept('version')
  return data
}

export async function retractPublication(publicationId: number, reason: string) {
  const { data } = await api(`/editor/publications/${publicationId}/retract`, { method: 'POST', body: { retraction_reason: reason }, schema: publicationRefSchema })
  if (data.status !== 'retracted') throw notKept('retraction')
  return data
}
