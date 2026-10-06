import type { AppNotification } from '@/api/schemas/notifications'

/** The kinds the server sends today (every place it creates a notification). Any other is shown by its own name. */
export const KNOWN_TYPES = ['invitation', 'invitation_accepted', 'role_updated', 'assignment'] as const
export type KnownType = (typeof KNOWN_TYPES)[number]
export const isKnownType = (t: string): t is KnownType => (KNOWN_TYPES as readonly string[]).includes(t)

/**
 * Where a notification leads, or null when it cannot lead anywhere honestly.
 *  - an invitation leads nowhere: the notification does not carry the link, and the invited person cannot open the
 *    project before accepting (request file C-24);
 *  - a task has no project in the notification, so the project comes from the person's assigned tasks;
 *  - a project the person was removed from is "not available" when opened, which the project shell says itself.
 */
export function notificationHref(n: Pick<AppNotification, 'type' | 'target_type' | 'target_id'>, projectOfTask: (taskId: number) => number | null): string | null {
  if (n.type === 'invitation') return null
  if (n.target_type === 'project' && n.target_id) return n.type === 'invitation_accepted' ? `/projects/${n.target_id}/members` : `/projects/${n.target_id}/overview`
  if (n.target_type === 'task' && n.target_id) {
    const project = projectOfTask(n.target_id)
    return project ? `/projects/${project}/discussion?view=tasks&mine=1` : null
  }
  return null
}

/** Whether the page holds a notification that needs the assigned-task lookup. */
export const needsTaskLookup = (items: readonly AppNotification[]) => items.some((n) => n.target_type === 'task' && n.target_id)

export const unreadOn = (items: readonly AppNotification[]) => items.filter((n) => !n.is_read).length
