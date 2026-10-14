import type { AppNotification } from '@/api/schemas/notifications'

/** The kinds the server sends today (every place it creates a notification). Any other is shown by its own name. */
export const KNOWN_TYPES = ['invitation', 'invitation_accepted', 'role_updated', 'assignment'] as const
export type KnownType = (typeof KNOWN_TYPES)[number]
export const isKnownType = (t: string): t is KnownType => (KNOWN_TYPES as readonly string[]).includes(t)

/**
 * Where a notification leads, or null when it cannot lead anywhere honestly.
 *  - an invitation leads to the page that answers it, when the notification carries the token of the pending invitation;
 *    without one (answered, withdrawn or expired) it leads nowhere, because the project cannot be opened before accepting;
 *  - a task leads to the project the notification names, or, for an older notification without one, the project found in
 *    the person's assigned tasks;
 *  - a project the person was removed from is "not available" when opened, which the project shell says itself.
 */
export function notificationHref(
  n: Pick<AppNotification, 'type' | 'target_type' | 'target_id'> & Partial<Pick<AppNotification, 'project_id' | 'invitation_token'>>,
  projectOfTask: (taskId: number) => number | null,
): string | null {
  if (n.type === 'invitation') return n.invitation_token ? `/invitations/${encodeURIComponent(n.invitation_token)}` : null
  if (n.target_type === 'project' && n.target_id) return n.type === 'invitation_accepted' ? `/projects/${n.target_id}/members` : `/projects/${n.target_id}/overview`
  if (n.target_type === 'task' && n.target_id) {
    const project = n.project_id ?? projectOfTask(n.target_id)
    return project ? `/projects/${project}/discussion?view=tasks&mine=1` : null
  }
  return null
}

/** Whether the page holds a task notification that does not name its project, so it needs the assigned-task lookup. */
export const needsTaskLookup = (items: readonly AppNotification[]) => items.some((n) => n.target_type === 'task' && n.target_id && !n.project_id)

export const unreadOn = (items: readonly AppNotification[]) => items.filter((n) => !n.is_read).length
