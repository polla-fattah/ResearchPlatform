import { dayOf } from '@/api/discussion'
import type { Comment, TargetType, Task, Thread } from '@/api/schemas/discussion'
import { TARGET_TYPES } from '@/api/schemas/discussion'

export type ThreadFilter = 'open' | 'resolved' | 'all'
export const THREAD_FILTERS: readonly ThreadFilter[] = ['open', 'resolved', 'all']

export const threadCounts = (items: readonly Thread[]) => ({
  open: items.filter((t) => !t.is_resolved).length,
  resolved: items.filter((t) => t.is_resolved).length,
  all: items.length,
})

export const visibleThreads = (items: readonly Thread[], filter: ThreadFilter) =>
  filter === 'all' ? [...items] : items.filter((t) => t.is_resolved === (filter === 'resolved'))

export const isTargetType = (value: string | null | undefined): value is TargetType =>
  (TARGET_TYPES as readonly string[]).includes(value ?? '')

/** Where the object a discussion is about is shown. Passages and unknown kinds have no page of their own. */
export function targetHref(projectId: number, type: string | null | undefined, id: number | null | undefined): string | null {
  const base = `/projects/${projectId}`
  switch (type) {
    case 'project':
      return `${base}/overview`
    case 'evidence':
      return id ? `${base}/evidence?item=${id}` : null
    case 'finding':
      return id ? `${base}/findings?finding=${id}` : null
    case 'document':
      return id ? `${base}/findings?doc=${id}` : null
    case 'analysis':
      return id ? `${base}/analysis?run=${id}` : null
    default:
      return null
  }
}

/** Who opened the thread. The server does not say; the first reply is the opening comment, so its author is it. */
export const openedBy = (comments: readonly Comment[] | undefined): string | null =>
  comments?.[0]?.author?.display_name ?? null

export type DueState = 'overdue' | 'today' | 'later' | null

/**
 * Where a due day stands. Judged against the moment the list was loaded (never the clock in render), in the person's
 * own day; a finished task is never overdue.
 */
export function dueState(task: Pick<Task, 'due_date' | 'status'>, now: number): DueState {
  const due = dayOf(task.due_date)
  if (!due || task.status === 'done') return null
  const today = new Date(now)
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  if (due < key) return 'overdue'
  return due === key ? 'today' : 'later'
}

/** A day typed into a date field becomes the server's date; an empty field clears it. */
export const dueForServer = (day: string): string | null => (day.trim() === '' ? null : day.trim())
