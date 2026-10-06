import type { Assignment } from '@/api/schemas/review'

export type AssignmentState = 'to_review' | 'submitted'

/** An assignment is done when the server has a completion time; nothing else on it says so. */
export const assignmentState = (a: Pick<Assignment, 'completed_at'>): AssignmentState => (a.completed_at ? 'submitted' : 'to_review')

export type DueState = 'overdue' | 'soon' | 'later' | null

/** How close the due day is, at the moment the list was loaded: overdue, within three days, later, or no due day. */
export function dueState(a: Pick<Assignment, 'due_date' | 'completed_at'>, now: number): DueState {
  if (a.completed_at || !a.due_date) return null
  const due = Date.parse(a.due_date)
  if (!Number.isFinite(due)) return null
  if (due < now) return 'overdue'
  return due - now <= 3 * 86_400_000 ? 'soon' : 'later'
}

export const MIN_NOTES = 10
export const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

/** A review may be sent with a recommendation, notes of at least ten characters, and (if given) a score from 1 to 10. */
export function canSubmitReview(v: { recommendation: string | null; notes: string; score: number | null }): boolean {
  if (!v.recommendation) return false
  if (v.notes.trim().length < MIN_NOTES) return false
  return v.score === null || (Number.isInteger(v.score) && v.score >= 1 && v.score <= 10)
}

/** Units of the package for the "included" line: the number of citations across the documents. */
export function citationCount(pack: { documents?: readonly { latest_version?: { citations?: readonly unknown[] | null } | null }[] | null } | null | undefined): number {
  return (pack?.documents ?? []).reduce((sum, d) => sum + (d.latest_version?.citations?.length ?? 0), 0)
}
