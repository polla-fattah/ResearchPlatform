import { z } from 'zod'
import { ApiError } from './errors'
import { api } from './http'
import { collaborationRequestSchema, decidedRequestSchema } from './schemas/collaboration'

export interface InterestInput {
  name: string
  email: string
  affiliation?: string
  message: string
}

/**
 * Sends a request from a public announcement page. The server asks for the name, the e-mail address, an optional
 * affiliation, a message of at least ten characters and a consent that must be true; all of them are sent, and the
 * consent is only ever `true` (a form that was not agreed to is never sent).
 */
export async function sendInterest(slug: string, input: InterestInput) {
  await api(`/public/announcements/${encodeURIComponent(slug)}/collaboration-requests`, {
    method: 'POST',
    body: { name: input.name, email: input.email, affiliation: input.affiliation || undefined, message: input.message, consent: true },
    schema: z.unknown(),
  })
}

/** The requests sent to a project. The owner's inbox; the server also lets researchers read it (request file C-28). */
export async function listCollaborationRequests(projectId: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/collaboration-requests`, { schema: z.array(collaborationRequestSchema), signal })
  return data
}

/**
 * Declines a request. Accepting is not offered here: the server's "accepted" makes the person a member at once, with no
 * invitation for them to answer, so an owner who accepts invites by e-mail instead (request file C-28).
 */
export async function declineCollaborationRequest(projectId: number, requestId: number, notes: string) {
  const { data } = await api(`/projects/${projectId}/collaboration-requests/${requestId}`, {
    method: 'PATCH',
    body: { status: 'declined', decision_notes: notes || undefined },
    schema: decidedRequestSchema,
  })
  if (data.status !== 'declined') {
    throw new ApiError({ status: 200, code: 'NOT_PERSISTED', message: 'The server did not keep the change.', details: { what: 'change' } })
  }
  return data
}
