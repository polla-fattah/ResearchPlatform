import type { Invitation, Member } from '@/api/schemas/members'
import { can, normalizeRole, type ProjectAction, type ProjectRole } from '@/domain/roles'

/** A person in the project, as the table shows them. */
export interface MemberRow {
  userId: number
  name: string
  affiliation: string | null
  role: ProjectRole
  joinedAt: string | null
  isOwner: boolean
  /** Null when the server did not give a summary (the owner row built from the project has none). */
  contributions: { evidence: number; documents: number; comments: number; tasks: number } | null
}

/**
 * The people in the project: the owner first, then the others by the day they joined. The server's list may leave the
 * owner out (they are the project's owner, not a membership), so the project's own owner fills the gap. A role this app
 * does not know is shown as the least a person can be (viewer), never as more.
 */
export function memberRows(members: readonly Member[], owner: { id: number; name: string | null } | null): MemberRow[] {
  const rows: MemberRow[] = members.map((m) => {
    const isOwner = owner !== null && m.user_id === owner.id
    const c = m.contribution_summary
    return {
      userId: m.user_id,
      name: m.user?.display_name ?? '',
      affiliation: m.user?.affiliation ?? null,
      role: isOwner ? 'owner' : (normalizeRole(m.role) ?? 'viewer'),
      joinedAt: m.joined_at ?? null,
      isOwner,
      contributions: c
        ? { evidence: c.evidence_items ?? 0, documents: c.documents ?? 0, comments: c.comments ?? 0, tasks: c.tasks ?? 0 }
        : null,
    }
  })
  if (owner && !rows.some((r) => r.isOwner)) {
    rows.push({ userId: owner.id, name: owner.name ?? '', affiliation: null, role: 'owner', joinedAt: null, isOwner: true, contributions: null })
  }
  return rows.sort((a, b) => {
    if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1
    return (a.joinedAt ?? '').localeCompare(b.joinedAt ?? '') || a.userId - b.userId
  })
}

export type InvitationState = 'waiting' | 'expired' | 'declined' | 'accepted' | 'other'

/** A waiting invitation whose day has passed is expired, even though the server still says pending. */
export function invitationState(inv: Pick<Invitation, 'status' | 'expires_at'>, now: number): InvitationState {
  if (inv.status === 'accepted') return 'accepted'
  if (inv.status === 'declined') return 'declined'
  if (inv.status === 'expired') return 'expired'
  if (inv.status === 'pending') {
    const end = inv.expires_at ? Date.parse(inv.expires_at) : NaN
    return Number.isFinite(end) && end <= now ? 'expired' : 'waiting'
  }
  return 'other'
}

/** Accepted invitations are people already in the list above; they are not repeated. */
export const openInvitations = (all: readonly Invitation[]) => all.filter((i) => i.status !== 'accepted')

/** The address the invited person opens. No e-mail is sent by the server, so the owner passes this on (C-22). */
export const invitationLink = (origin: string, token: string) => `${origin}/invitations/${encodeURIComponent(token)}`

export const ROLES: readonly ProjectRole[] = ['owner', 'researcher', 'reviewer', 'viewer']

/** What each role may do, read from the same table the screens use, so the two cannot disagree. */
export const ROLE_ACTIONS: readonly ProjectAction[] = [
  'read',
  'addShared',
  'editShared',
  'comment',
  'manageTasks',
  'createPrivateAnnotation',
  'download',
  'manageMembers',
  'manageSettings',
  'publishAnnouncement',
  'submitFormal',
  'archiveOrTrash',
]

export const roleMatrix = () => ROLE_ACTIONS.map((action) => ({ action, allowed: ROLES.map((role) => can(role, action)) }))

/** The roles an owner may give: every role but owner (ownership moves by transfer, never by a role change). */
export const GRANTABLE: readonly Exclude<ProjectRole, 'owner'>[] = ['researcher', 'reviewer', 'viewer']
