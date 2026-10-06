import { z } from 'zod'

/** The roles the server accepts when inviting or changing a member. The owner is not one of them. */
export const INVITABLE_ROLES = ['researcher', 'reviewer', 'viewer'] as const
export type InvitableRole = (typeof INVITABLE_ROLES)[number]

/**
 * One row of GET /projects/{id}/members. The list holds every membership the project has ever had, so `status` is
 * read, and anything but `accepted` is dropped by the caller (request file C-22).
 */
export const memberSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  role: z.string(),
  status: z.string().nullable().optional(),
  joined_at: z.string().nullable().optional(),
  invited_by: z.number().nullable().optional(),
  user: z
    .object({
      id: z.number().nullable().optional(),
      display_name: z.string().nullable().optional(),
      affiliation: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  contribution_summary: z
    .object({
      evidence_items: z.number().optional(),
      documents: z.number().optional(),
      comments: z.number().optional(),
      tasks: z.number().optional(),
      // The server's `findings` is the number in the whole project, not the member's: never read (C-22).
    })
    .passthrough()
    .nullable()
    .optional(),
})
export type Member = z.infer<typeof memberSchema>

/** One row of GET /projects/{id}/invitations (owner only). */
export const invitationSchema = z.object({
  id: z.number(),
  email: z.string(),
  role: z.string(),
  token: z.string().nullable().optional(),
  status: z.string(),
  expires_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  accepted_at: z.string().nullable().optional(),
  invited_user_id: z.number().nullable().optional(),
  inviter: z.object({ id: z.number().nullable().optional(), display_name: z.string().nullable().optional() }).nullable().optional(),
})
export type Invitation = z.infer<typeof invitationSchema>

/** GET /invitations/{token}: public, so it says only what the design allows an invitation to show. */
export const invitationPreviewSchema = z.object({
  token: z.string(),
  project_id: z.number(),
  project_title: z.string().nullable().optional(),
  inviter: z.string().nullable().optional(),
  role: z.string(),
  status: z.string(),
  expires_at: z.string().nullable().optional(),
  is_expired: z.boolean().optional(),
})
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>

/** What the server answers to a membership change: the membership itself. */
export const membershipSchema = z.object({
  id: z.number().optional(),
  user_id: z.number().optional(),
  role: z.string(),
  status: z.string().nullable().optional(),
})
