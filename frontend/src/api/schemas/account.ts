import { z } from 'zod'

/** Shapes of the account endpoints as observed on the live backend on 6 Oct 2026 (request file C-21). */

/** The fields a researcher can make public. The display name is shown whenever the profile is public. */
export const PUBLIC_FIELDS = ['research_interests', 'affiliation', 'biography', 'email'] as const
export type PublicField = (typeof PUBLIC_FIELDS)[number]

export const NUMERALS = ['eastern_arabic', 'western'] as const
export const CALENDARS = ['gregorian_hijri', 'hijri_gregorian', 'gregorian'] as const

export const displayPreferencesSchema = z.object({
  default_content_language: z.string().nullable().optional(),
  numerals: z.string().nullable().optional(),
  calendar: z.string().nullable().optional(),
  time_zone: z.string().nullable().optional(),
})
export type AccountDisplayPreferences = z.infer<typeof displayPreferencesSchema>

/** A sign-in on some device. The server names every device "Web Browser", so only the dates tell them apart. */
export const sessionSchema = z.object({
  id: z.number(),
  name: z.string().nullable().optional(),
  device: z.string().nullable().optional(),
  last_used_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  current: z.boolean(),
})
export type AccountSession = z.infer<typeof sessionSchema>

export const mfaEnrollSchema = z.object({ secret: z.string(), otpauth_url: z.string() })
export const mfaConfirmSchema = z.object({ mfa_enabled: z.boolean(), recovery_codes: z.array(z.string()) })
export const mfaDisableSchema = z.object({ mfa_enabled: z.boolean() })

export const NOTIFICATION_FLAGS = [
  'notify_exports',
  'notify_search_runs',
  'notify_source_changes',
  'notify_corpus_proposals',
  'notify_invitations',
  'notify_mentions',
  'notify_assignments',
  'notify_reviews',
] as const
export type NotificationFlag = (typeof NOTIFICATION_FLAGS)[number]

export const DIGESTS = ['instant', 'daily', 'weekly', 'never'] as const

const flag = z.boolean().nullable().optional()
export const notificationPreferencesSchema = z.object({
  notify_exports: flag,
  notify_search_runs: flag,
  notify_source_changes: flag,
  notify_corpus_proposals: flag,
  notify_invitations: flag,
  notify_mentions: flag,
  notify_assignments: flag,
  notify_reviews: flag,
  email_digest: z.string().nullable().optional(),
})
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>

export const closeAccountSchema = z.object({ status: z.string(), policy: z.string().nullable().optional() })

/** What `PATCH /auth/profile` answers: the account with its profile. Only what the screen compares is read. */
export const savedProfileSchema = z.object({
  id: z.number(),
  display_name: z.string(),
  preferred_language: z.string().nullable().optional(),
  profile: z
    .object({
      affiliation: z.string().nullable().optional(),
      biography: z.string().nullable().optional(),
      research_interests: z.array(z.string()).nullable().optional(),
      is_public: z.boolean().nullable().optional(),
      public_fields: z.union([z.array(z.string()), z.record(z.string(), z.unknown())]).nullable().optional(),
      display_preferences: displayPreferencesSchema.nullable().optional(),
    })
    .nullable()
    .optional(),
})
