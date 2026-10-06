import type { AdminApplication, PlatformRole, SupportGrant } from '@/api/schemas/admin'
import { formatCode } from '@/domain/codes'

/** The views of the administration area, in the order of its navigation. The path is the last part of `/admin/…`. */
export const ADMIN_VIEWS = ['applications', 'accounts', 'proposals', 'limits', 'support', 'audit', 'operations'] as const
export type AdminView = (typeof ADMIN_VIEWS)[number]

// ── accounts ──────────────────────────────────────────────────────────────────────────────────────────────────
export const accountCode = (id: number) => formatCode('ACC', id)

/** Account states an administrator can filter by. `closure_requested` has its own section. */
export const ACCOUNT_STATUSES = ['approved', 'pending', 'suspended', 'rejected', 'unverified'] as const

/** Roles in the order the dialog lists them: the person's usual work first, the powers that need care last. */
export const ROLE_ORDER: PlatformRole[] = ['researcher', 'reviewer', 'editor', 'corpus_editor', 'admin']

/** The roles an account has that an administrator can set (the API also reports `applicant`, which is a state, not a role). */
export const settableRoles = (roles: readonly string[]): PlatformRole[] => ROLE_ORDER.filter((r) => roles.includes(r))

/** The account's highest role, for the one-word "Platform role" column. */
export function topRole(roles: readonly string[]): PlatformRole | null {
  for (const r of [...ROLE_ORDER].reverse()) if (roles.includes(r)) return r
  return null
}

// ── applications ──────────────────────────────────────────────────────────────────────────────────────────────
/** The queue: applications waiting for a decision, and the ones waiting for the applicant's answer. */
export const QUEUE_STATUSES = ['pending', 'information_requested', 'approved', 'rejected'] as const

export const applicationCode = (a: Pick<AdminApplication, 'id' | 'reference'>) => a.reference ?? formatCode('APP', a.id)

/** An application can be decided while it is waiting; a decided one is shown, not changed (the server would allow it). */
export const isOpen = (status: string) => status === 'pending' || status === 'information_requested'

/** The shortest reason the server accepts for a decision that has one (`decision_reason` has `min:5`). */
export const MIN_REASON = 5

// ── support access ────────────────────────────────────────────────────────────────────────────────────────────
export interface GrantState {
  state: 'active' | 'expired'
  /** Whole hours left while active. */
  hoursLeft: number
}

export function grantState(grant: Pick<SupportGrant, 'expires_at'>, nowMs: number): GrantState {
  const end = grant.expires_at ? Date.parse(grant.expires_at) : NaN
  if (!Number.isFinite(end) || end <= nowMs) return { state: 'expired', hoursLeft: 0 }
  return { state: 'active', hoursLeft: Math.ceil((end - nowMs) / 3_600_000) }
}

// ── audit ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** The actions the server records today. Any other action is shown as it is. */
export const AUDIT_ACTIONS = [
  'decide_application',
  'update_user_roles',
  'update_user_status',
  'update_own_role_refused',
  'decide_corpus_proposal',
  'project_created',
  'assign_reviewer',
  'submit_review',
  'editorial_decision',
  'release_publication',
  'add_corrigendum',
  'retract_publication',
] as const
export const AUDIT_OBJECTS = ['user', 'researcher_application', 'corpus_correction_proposal', 'project', 'submission', 'publication', 'review_assignment'] as const

const OBJECT_PREFIX: Record<string, Parameters<typeof formatCode>[0]> = {
  user: 'ACC',
  researcher_application: 'APP',
  corpus_correction_proposal: 'COR',
  project: 'PRJ',
  export_job: 'EXP',
  submission: 'SUB',
}

/** "ACC-0007", "PRJ-0015"; the type and number for an object the screen has no code for. */
export function objectCode(type: string | null | undefined, id: number | null | undefined): string {
  if (!type) return '—'
  if (id === null || id === undefined) return type
  const prefix = OBJECT_PREFIX[type]
  return prefix ? formatCode(prefix, id) : `${type} #${id}`
}

/** The windows of the audit log's time filter, in hours. */
export const AUDIT_WINDOWS = { day: 24, week: 24 * 7, month: 24 * 30 } as const
export type AuditWindow = keyof typeof AUDIT_WINDOWS

/** The start of a window as the date the server filters by. */
export function windowStart(window: AuditWindow, nowMs: number): string {
  return new Date(nowMs - AUDIT_WINDOWS[window] * 3_600_000).toISOString()
}

// ── limits and storage ────────────────────────────────────────────────────────────────────────────────────────
export function humanBytes(bytes: number): { value: number; unit: 'B' | 'KB' | 'MB' | 'GB' } {
  const units = ['B', 'KB', 'MB', 'GB'] as const
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return { value: i === 0 ? value : Math.round(value * 10) / 10, unit: units[i]! }
}

/** The limits the server reports, grouped as the design groups them. A limit it reports that is not listed here is still shown. */
export const LIMIT_GROUPS: { id: 'access' | 'quotas'; keys: string[] }[] = [
  { id: 'access', keys: ['applications_per_email_per_day', 'resend_verification_per_minute', 'resend_verification_per_day', 'invitations_per_project_per_day'] },
  { id: 'quotas', keys: ['download_storage_limit_gb', 'package_part_size_gb', 'concurrent_export_jobs', 'result_set_max_size'] },
]

export function ungroupedLimits(limits: Record<string, unknown>): string[] {
  const known = new Set(LIMIT_GROUPS.flatMap((g) => g.keys))
  return Object.keys(limits).filter((k) => !known.has(k))
}
