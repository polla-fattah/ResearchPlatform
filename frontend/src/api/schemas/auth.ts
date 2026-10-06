import { z } from 'zod'

/** Backend values today: unverified | pending | approved | suspended (rejected is requested, DEF-6). */
export type AccountStatus = 'unverified' | 'pending' | 'approved' | 'rejected' | 'suspended' | 'closure_requested'

const ACCOUNT_STATUSES: readonly string[] = [
  'unverified',
  'pending',
  'approved',
  'rejected',
  'suspended',
  'closure_requested',
]

export function asAccountStatus(value: string): AccountStatus | 'unknown' {
  return ACCOUNT_STATUSES.includes(value) ? (value as AccountStatus) : 'unknown'
}

export const languageSchema = z.enum(['ar', 'ckb', 'en'])
export type ContentLanguage = z.infer<typeof languageSchema>

export const userSchema = z.object({
  id: z.number(),
  display_name: z.string(),
  email: z.string(),
  status: z.string(),
  preferred_language: z.string().nullable().optional(),
  // Not returned by the backend yet (DEF-6); read defensively.
  is_admin: z.boolean().optional(),
  roles: z.array(z.string()).optional(),
  mfa_enabled: z.boolean().optional(),
})
export type User = z.infer<typeof userSchema>

export const sessionResultSchema = z.object({
  user: userSchema,
  token: z.string(),
})

/** With TOTP enabled, login answers with a challenge instead of a token. */
export const mfaChallengeSchema = z.object({
  mfa_required: z.literal(true),
  challenge_token: z.string(),
})

export const loginResultSchema = z.union([sessionResultSchema, mfaChallengeSchema])

/** Register also returns a dev-only verification_token (request file C-2); it is ignored. */
export const registerResultSchema = sessionResultSchema

export const meSchema = userSchema.extend({
  profile: z
    .object({
      affiliation: z.string().nullable().optional(),
      biography: z.string().nullable().optional(),
      research_interests: z.array(z.string()).nullable().optional(),
      is_public: z.boolean().optional(),
      /** The backend returns either a list or a map of booleans (request file C-10). */
      public_fields: z
        .union([z.array(z.string()), z.record(z.string(), z.boolean())])
        .nullable()
        .optional(),
      /** What the person chose; null until they do (the top-level `display_preferences` then holds server defaults). */
      display_preferences: z
        .object({
          default_content_language: z.string().nullable().optional(),
          numerals: z.string().nullable().optional(),
          calendar: z.string().nullable().optional(),
          time_zone: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
  display_preferences: z
    .object({
      default_content_language: z.string().optional(),
      numerals: z.string().optional(),
      calendar: z.string().optional(),
      time_zone: z.string().optional(),
    })
    .nullable()
    .optional(),
  stats: z
    .object({
      owned_projects_count: z.number(),
      memberships_count: z.number(),
      library_items_count: z.number(),
    })
    .optional(),
})
export type Me = z.infer<typeof meSchema>

export interface RegisterInput {
  display_name: string
  email: string
  password: string
  preferred_language?: ContentLanguage
  affiliation?: string
  biography?: string
  research_interests?: string[]
}
