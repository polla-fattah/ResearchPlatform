import { z } from 'zod'
import { languageSchema } from './auth'

/** Body of the public apply form (design screen 01). The API takes the password in the same call. */
export interface ApplyInput {
  display_name: string
  email: string
  password: string
  password_confirmation: string
  /** Free text; the backend splits it on commas for the profile and keeps it as the statement. */
  research_interests: string
  preferred_language: z.infer<typeof languageSchema>
  affiliation?: string
  biography?: string
}

export const applyResultSchema = z.object({
  user: z.object({
    id: z.number(),
    display_name: z.string(),
    email: z.string(),
    status: z.string(),
  }),
  application: z
    .object({
      id: z.number(),
      reference: z.string().nullable().optional(),
      status: z.string(),
    })
    .nullable()
    .optional(),
  token: z.string(),
})

export const informationRequestSchema = z.object({
  message: z.string(),
  requested_at: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
})

export const applicationReplySchema = z.object({
  id: z.number(),
  message: z.string(),
  created_at: z.string().nullable().optional(),
})

/** application.status values seen: pending | information_requested | approved | rejected. */
export const myStatusSchema = z.object({
  user_status: z.string(),
  application: z
    .object({
      id: z.number(),
      reference: z.string().nullable().optional(),
      status: z.string(),
      submitted_at: z.string().nullable().optional(),
      decision_reason: z.string().nullable().optional(),
      decided_at: z.string().nullable().optional(),
      information_request: informationRequestSchema.nullable().optional(),
      replies: z.array(applicationReplySchema).optional(),
    })
    .nullable(),
})
export type MyStatus = z.infer<typeof myStatusSchema>

export const resendResultSchema = z
  .object({
    remaining_today: z.number().optional(),
    /** Dev-only leak (request file C-2). Never relied on outside DEV. */
    verification_token: z.string().optional(),
  })
  .nullable()
