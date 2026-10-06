import { z } from 'zod'

/**
 * Shapes of the administration endpoints as observed on the live backend on 6 Oct 2026 (request file C-20).
 *
 * The API embeds whole accounts in several of these; only what the screen shows is read. PHP sends an empty map as
 * `[]`, so open maps go through `looseMap`.
 */
const looseMap = z.preprocess((v) => (Array.isArray(v) && v.length === 0 ? {} : v), z.record(z.string(), z.unknown()))
const person = z.object({ id: z.number(), display_name: z.string() })

/** The roles an administrator can give (`PATCH /admin/users/{id}/roles` accepts only these). */
export const PLATFORM_ROLES = ['admin', 'editor', 'corpus_editor', 'researcher', 'reviewer'] as const
export type PlatformRole = (typeof PLATFORM_ROLES)[number]

export const adminUserSchema = z.object({
  id: z.number(),
  display_name: z.string(),
  email: z.string(),
  /** Not narrowed: the API also sends `applicant` and may add more. */
  roles: z.array(z.string()),
  /** approved | pending | unverified | suspended | rejected | closure_requested */
  status: z.string(),
  is_admin: z.boolean(),
  /** `totp` or `none`. */
  mfa: z.string(),
  created_at: z.string().nullable().optional(),
  last_login_at: z.string().nullable().optional(),
})
export type AdminUser = z.infer<typeof adminUserSchema>

export const informationRequestSchema = z.object({
  message: z.string(),
  requested_at: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
})

export const adminApplicationSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  /** pending | information_requested | approved | rejected */
  status: z.string(),
  reference: z.string().nullable().optional(),
  research_statement: z.string().nullable().optional(),
  decision_reason: z.string().nullable().optional(),
  decided_by: z.number().nullable().optional(),
  decided_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  information_request: informationRequestSchema.nullable().optional(),
  user: z.object({
    id: z.number(),
    display_name: z.string(),
    email: z.string(),
    preferred_language: z.string().nullable().optional(),
    status: z.string(),
    profile: z
      .object({
        affiliation: z.string().nullable().optional(),
        biography: z.string().nullable().optional(),
        research_interests: z.array(z.string()).nullable().optional(),
      })
      .nullable()
      .optional(),
  }),
  replies: z.array(z.object({ id: z.number(), message: z.string(), created_at: z.string().nullable().optional() })).optional(),
})
export type AdminApplication = z.infer<typeof adminApplicationSchema>

export const closureSchema = z.object({
  id: z.number(),
  display_name: z.string(),
  email: z.string(),
  closure_requested_at: z.string().nullable().optional(),
  closure_reason: z.string().nullable().optional(),
})
export type ClosureRequest = z.infer<typeof closureSchema>

/** Limit name → value. Names are the server's; a value is a number today but the server does not check. */
export const limitsSchema = z.record(z.string(), z.unknown())

export const supportGrantSchema = z.object({
  id: z.number(),
  researcher_id: z.number().nullable().optional(),
  admin_id: z.number().nullable().optional(),
  /** project | document */
  scope: z.string(),
  object_id: z.number(),
  expires_at: z.string().nullable().optional(),
  reason: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  researcher: person.nullable().optional(),
  admin: person.nullable().optional(),
})
export type SupportGrant = z.infer<typeof supportGrantSchema>

export const adminJobSchema = z.object({
  id: z.number(),
  requester_id: z.number().nullable().optional(),
  scope: z.string().nullable().optional(),
  target_id: z.number().nullable().optional(),
  format: z.string().nullable().optional(),
  status: z.string(),
  progress: z.string().nullable().optional(),
  failure_reason: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
})
export type AdminJob = z.infer<typeof adminJobSchema>

export const opsSchema = z.object({
  queue_depth: z.number(),
  failures_count: z.number(),
  storage_used_bytes: z.number(),
  active_alerts: z.array(z.object({ severity: z.string(), message: z.string() })),
})
export type Ops = z.infer<typeof opsSchema>

export const auditEntrySchema = z.object({
  id: z.number(),
  actor_id: z.number().nullable().optional(),
  /** Only the name is read: the server embeds the account with roles that are not the account's. */
  actor: z.object({ id: z.number(), display_name: z.string() }).nullable().optional(),
  action: z.string(),
  object_type: z.string().nullable().optional(),
  object_id: z.number().nullable().optional(),
  details: looseMap.nullable().optional(),
  created_at: z.string().nullable().optional(),
})
export type AuditEntry = z.infer<typeof auditEntrySchema>

export const proposalSchema = z.object({
  id: z.number(),
  researcher_id: z.number().nullable().optional(),
  /** hadiths | narrators | books | sanads */
  corpus_table: z.string(),
  corpus_id: z.number(),
  current_value: z.string().nullable().optional(),
  proposed_value: z.string().nullable().optional(),
  evidence_notes: z.string().nullable().optional(),
  /** submitted | accepted | rejected (the ops alert looks for `pending`, request file C-20). */
  status: z.string(),
  decided_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  researcher: person.nullable().optional(),
  decider: person.nullable().optional(),
})
export type CorpusProposal = z.infer<typeof proposalSchema>
