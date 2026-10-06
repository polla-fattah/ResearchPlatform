import { z } from 'zod'
import { ApiError } from './errors'
import { api } from './http'
import {
  invitationPreviewSchema,
  invitationSchema,
  memberSchema,
  membershipSchema,
  type InvitableRole,
} from './schemas/members'

const notKept = (what: string) =>
  new ApiError({ status: 200, code: 'NOT_PERSISTED', message: `The server did not keep the ${what}.`, details: { what } })

/** How long an invitation stays open, in days (the design says 14; the server allows 1 to 30). */
export const INVITATION_DAYS = 14

/** The people in the project now. Revoked and other past memberships are dropped here, once (C-22). */
export async function listMembers(projectId: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/members`, { schema: z.array(memberSchema), signal })
  return data.filter((m) => !m.status || m.status === 'accepted')
}

export async function listInvitations(projectId: number, page = 1, signal?: AbortSignal) {
  const res = await api(`/projects/${projectId}/invitations`, {
    query: { page, per_page: 50 },
    schema: z.array(invitationSchema),
    signal,
  })
  return { items: res.data, pagination: res.pagination }
}

/** The server answers 409 for a person who is already a member and for one with an invitation still open. */
export async function createInvitation(projectId: number, input: { email: string; role: InvitableRole }) {
  const { data } = await api(`/projects/${projectId}/invitations`, {
    method: 'POST',
    body: { email: input.email, role: input.role, expires_days: INVITATION_DAYS },
    schema: invitationSchema,
  })
  if (data.role !== input.role) throw notKept('role')
  return data
}

export async function resendInvitation(projectId: number, invitationId: number) {
  const { data } = await api(`/projects/${projectId}/invitations/${invitationId}/resend`, { method: 'POST', schema: invitationSchema })
  return data
}

export async function withdrawInvitation(projectId: number, invitationId: number) {
  await api(`/projects/${projectId}/invitations/${invitationId}`, { method: 'DELETE' })
}

/** Uses the project route that refuses `owner` as a role (the other route accepts it, C-22). The answer is checked. */
export async function changeMemberRole(projectId: number, userId: number, role: InvitableRole) {
  const { data } = await api(`/projects/${projectId}/members/${userId}`, { method: 'PATCH', body: { role }, schema: membershipSchema })
  if (data.role !== role) throw notKept('role')
  return data
}

export async function removeMember(projectId: number, userId: number) {
  await api(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' })
}

export async function leaveProject(projectId: number) {
  await api(`/projects/${projectId}/leave`, { method: 'POST' })
}

// ── answering an invitation ───────────────────────────────────────────────────────────────────────────────────
export async function getInvitation(token: string, signal?: AbortSignal) {
  const { data } = await api(`/invitations/${encodeURIComponent(token)}`, { schema: invitationPreviewSchema, signal })
  return data
}

export async function acceptInvitation(token: string) {
  await api(`/invitations/${encodeURIComponent(token)}/accept`, { method: 'POST' })
}

export async function declineInvitation(token: string) {
  await api(`/invitations/${encodeURIComponent(token)}/decline`, { method: 'POST' })
}
