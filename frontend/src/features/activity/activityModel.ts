import type { Activity } from '@/api/schemas/activity'

/** The kinds of change the server records today (every place it writes an activity entry). */
export const KNOWN_ACTIONS = [
  'invitation_created',
  'member_joined',
  'role_changed',
  'member_removed',
  'discussion_opened',
  'discussion_resolved',
  'discussion_reopened',
  'task_created',
  'task_completed',
  'stage_changed',
  'resource_added',
  'evidence_state_changed',
  'finding_created',
  'finding_updated',
  'finding_deleted',
  'document_created',
  'document_updated',
  'document_deleted',
  'document_version_saved',
  'document_version_restored',
  'announcement_saved',
  'announcement_published',
  'announcement_unpublished',
] as const
export const KNOWN_OBJECTS = ['project', 'membership', 'invitation', 'discussion_thread', 'task', 'evidence', 'resource', 'finding', 'document', 'announcement'] as const
export const RANGES = ['all', '7', '30'] as const
export type Range = (typeof RANGES)[number]

export const isKnownAction = (a: string) => (KNOWN_ACTIONS as readonly string[]).includes(a)
export const isKnownObject = (o: string | null | undefined) => (KNOWN_OBJECTS as readonly string[]).includes(o ?? '')

/**
 * The first day an entry may be from, as a plain day, for a range of "last N days". Taken from the app clock and cut to a
 * day, so the request (and its cache key) changes once a day and not every minute.
 */
export function rangeStart(range: Range, now: number): string | undefined {
  if (range === 'all') return undefined
  return new Date(now - Number(range) * 86_400_000).toISOString().slice(0, 10)
}

/** Where the object an entry is about is shown, or null when it has no screen of its own. */
export function activityHref(projectId: number, a: Pick<Activity, 'object_type' | 'object_id'> & Partial<Pick<Activity, 'action'>>): string | null {
  const base = `/projects/${projectId}`
  // A deleted finding or document has nothing to open.
  if (a.action === 'finding_deleted' || a.action === 'document_deleted') return null
  switch (a.object_type) {
    case 'project':
      return `${base}/overview`
    case 'membership':
    case 'invitation':
      return `${base}/members`
    case 'discussion_thread':
      return a.object_id ? `${base}/discussion?thread=${a.object_id}&state=all` : `${base}/discussion`
    case 'task':
      return `${base}/discussion?view=tasks`
    case 'evidence':
      return a.object_id ? `${base}/evidence?item=${a.object_id}` : `${base}/evidence`
    case 'resource':
      return `${base}/resources`
    case 'finding':
      return a.object_id ? `${base}/findings?finding=${a.object_id}` : `${base}/findings`
    case 'document':
      return a.object_id ? `${base}/findings?doc=${a.object_id}` : `${base}/findings`
    case 'announcement':
      return `${base}/announcement`
    default:
      return null
  }
}

/**
 * The sentence shown for an entry. The server's own sentence, except where it carries what the viewer should not read:
 * an invitation's sentence names the invited person's e-mail address, so anyone but the owner sees a plain one (request
 * file C-25).
 */
export function visibleSummary(a: Pick<Activity, 'action' | 'summary'>, canSeeInvitees: boolean): string | null {
  if (a.action === 'invitation_created' && !canSeeInvitees) return null
  return a.summary ?? null
}

/**
 * The title of the object an entry is about, for a line under the sentence. Left out when there is none, or when the
 * sentence already says it (the server's sentences often quote the title).
 */
export function objectTitleLine(a: Pick<Activity, 'object_title' | 'summary'>): string | null {
  const title = (a.object_title ?? '').trim()
  if (!title) return null
  return (a.summary ?? '').includes(title) ? null : title
}

/** Entries grouped by the day they happened (in the person's own day), newest day first, in the order given. */
export function groupByDay(items: readonly Activity[]): { day: string; items: Activity[] }[] {
  const groups: { day: string; items: Activity[] }[] = []
  for (const item of items) {
    const day = dayKey(item.created_at)
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.items.push(item)
    else groups.push({ day, items: [item] })
  }
  return groups
}

export function dayKey(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
