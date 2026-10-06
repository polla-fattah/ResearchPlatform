import { api } from './http'
import {
  applyResultSchema,
  myStatusSchema,
  type ApplyInput,
} from './schemas/application'

export const applicationKeys = {
  status: ['application', 'my-status'] as const,
}

/** Public: creates the account and the application in one call (no token needed). */
export async function applyForAccess(input: ApplyInput) {
  const { data } = await api('/applications', {
    method: 'POST',
    body: {
      ...input,
      affiliation: input.affiliation || undefined,
      biography: input.biography || undefined,
    },
    schema: applyResultSchema,
  })
  return data
}

export async function getMyStatus(signal?: AbortSignal) {
  const { data } = await api('/applications/my-status', { schema: myStatusSchema, signal })
  return data
}

/** Answers an information request, or asks for reconsideration after a rejection. */
export async function respondToApplication(message: string) {
  await api('/applications/respond', { method: 'POST', body: { message } })
}
