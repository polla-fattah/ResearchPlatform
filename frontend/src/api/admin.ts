import { z } from 'zod'
import { ApiError } from './errors'
import { api } from './http'
import {
  adminApplicationSchema,
  adminJobSchema,
  adminUserSchema,
  auditEntrySchema,
  closureSchema,
  limitsSchema,
  opsSchema,
  proposalSchema,
  supportGrantSchema,
  type PlatformRole,
} from './schemas/admin'

const PAGE = 20

function notKept(what: string): ApiError {
  return new ApiError({ status: 200, code: 'NOT_PERSISTED', message: `The server did not keep the ${what}.`, details: { what } })
}

// ── accounts ──────────────────────────────────────────────────────────────────────────────────────────────────
export interface UserQuery {
  q?: string
  status?: string
  page?: number
}

export async function listUsers(query: UserQuery, signal?: AbortSignal) {
  const res = await api('/admin/users', { query: { per_page: PAGE, ...query }, schema: z.array(adminUserSchema), signal })
  return { items: res.data, pagination: res.pagination }
}

/** How many accounts have a status (or all of them), for the counts beside the navigation. */
export async function countUsers(status?: string, signal?: AbortSignal) {
  const res = await api('/admin/users', { query: { per_page: 1, status }, schema: z.array(z.unknown()), signal })
  return res.pagination?.total_items ?? 0
}

/** Sets the platform roles. The answer is compared with what was asked. */
export async function setRoles(userId: number, roles: PlatformRole[]) {
  const { data } = await api(`/admin/users/${userId}/roles`, {
    method: 'PATCH',
    body: { roles },
    schema: z.object({ id: z.number(), roles: z.array(z.string()).nullable().optional(), is_admin: z.boolean().optional() }),
  })
  const got = new Set(data.roles ?? [])
  if (roles.some((r) => !got.has(r))) throw notKept('roles')
  return data
}

/** Suspends or reactivates an account. A reason is required by the server and goes into the audit log. */
export async function setStatus(userId: number, status: 'approved' | 'suspended', reason: string) {
  const { data } = await api(`/admin/users/${userId}/status`, {
    method: 'PATCH',
    body: { status, reason },
    schema: z.object({ id: z.number(), status: z.string() }),
  })
  if (data.status !== status) throw notKept('status')
  return data
}

export async function listClosures(signal?: AbortSignal) {
  const res = await api('/admin/closures', { query: { per_page: PAGE }, schema: z.array(closureSchema), signal })
  return { items: res.data, pagination: res.pagination }
}

export async function decideClosure(userId: number, decision: 'approved' | 'rejected', reason?: string) {
  await api(`/admin/closures/${userId}/decide`, { method: 'POST', body: { decision, reason: reason || undefined } })
}

// ── applications ──────────────────────────────────────────────────────────────────────────────────────────────
export interface ApplicationQuery {
  status?: string
  page?: number
}

export async function listApplications(query: ApplicationQuery, signal?: AbortSignal) {
  const res = await api('/admin/applications', { query: { per_page: PAGE, ...query }, schema: z.array(adminApplicationSchema), signal })
  return { items: res.data, pagination: res.pagination }
}

export async function countApplications(status: string, signal?: AbortSignal) {
  const res = await api('/admin/applications', { query: { per_page: 1, status }, schema: z.array(z.unknown()), signal })
  return res.pagination?.total_items ?? 0
}

export type Decision = 'approved' | 'rejected' | 'information_requested'

/** Records a decision. The reason (or the message, for a request) is shown to the applicant. */
export async function decideApplication(id: number, decision: Decision, text: string) {
  const { data } = await api(`/admin/applications/${id}/decide`, {
    method: 'POST',
    body: {
      decision,
      ...(decision === 'information_requested' ? { message: text } : text ? { decision_reason: text } : {}),
    },
    schema: z.object({ id: z.number(), status: z.string() }),
  })
  if (data.status !== decision) throw notKept('decision')
  return data
}

// ── limits, jobs, support, operations ─────────────────────────────────────────────────────────────────────────
export async function getLimits(signal?: AbortSignal) {
  const { data } = await api('/admin/limits', { schema: limitsSchema, signal })
  return data
}

export async function listSupportGrants(signal?: AbortSignal) {
  const { data } = await api('/admin/support-grants', { schema: z.array(supportGrantSchema), signal })
  return data
}

export async function revokeSupportGrant(id: number) {
  await api(`/researcher/support-grants/${id}`, { method: 'DELETE' })
}

export async function listJobs(query: { status?: string; page?: number }, signal?: AbortSignal) {
  const res = await api('/admin/jobs', { query: { per_page: PAGE, ...query }, schema: z.array(adminJobSchema), signal })
  return { items: res.data, pagination: res.pagination }
}

export async function getOps(signal?: AbortSignal) {
  const { data } = await api('/admin/ops', { schema: opsSchema, signal })
  return data
}

// ── audit ─────────────────────────────────────────────────────────────────────────────────────────────────────
export interface AuditQuery {
  action?: string
  object_type?: string
  actor_id?: number
  from?: string
  to?: string
  page?: number
}

export async function listAudit(query: AuditQuery, signal?: AbortSignal) {
  const res = await api('/admin/audit-logs', { query: { per_page: 50, ...query }, schema: z.array(auditEntrySchema), signal })
  return { items: res.data, pagination: res.pagination }
}

// ── corpus correction proposals ───────────────────────────────────────────────────────────────────────────────
export async function listProposals(query: { status?: string; page?: number }, signal?: AbortSignal) {
  const res = await api('/admin/corpus/proposals', { query: { per_page: PAGE, ...query }, schema: z.array(proposalSchema), signal })
  return { items: res.data, pagination: res.pagination }
}

export async function countProposals(status: string, signal?: AbortSignal) {
  const res = await api('/admin/corpus/proposals', { query: { per_page: 1, status }, schema: z.array(z.unknown()), signal })
  return res.pagination?.total_items ?? 0
}

export async function decideProposal(id: number, status: 'accepted' | 'rejected') {
  const { data } = await api(`/admin/corpus/proposals/${id}/decide`, {
    method: 'POST',
    body: { status },
    schema: z.object({ id: z.number(), status: z.string() }),
  })
  if (data.status !== status) throw notKept('decision')
  return data
}
