import { z } from 'zod'

/**
 * One collaboration request in the owner's inbox. The server embeds the whole requester account (e-mail, roles, profile);
 * the schema keeps only the name, and the address the requester chose to give (request file C-28).
 */
export const collaborationRequestSchema = z.object({
  id: z.number(),
  project_id: z.number().optional(),
  requester_id: z.number().nullable().optional(),
  message: z.string(),
  contact_email: z.string().nullable().optional(),
  status: z.string(),
  decision_notes: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  requester: z.object({ id: z.number().nullable().optional(), display_name: z.string().nullable().optional() }).nullable().optional(),
})
export type CollaborationRequest = z.infer<typeof collaborationRequestSchema>

/** What the server answers to a decision: the request with its new state. */
export const decidedRequestSchema = collaborationRequestSchema.pick({ id: true, status: true, decision_notes: true })
