import type { Candidate, EditorSubmission } from '@/api/schemas/editorial'

export type CaseStage = 'triage' | 'under_review' | 'ready_for_decision' | 'revisions_pending' | 'approved' | 'released' | 'retracted' | 'rejected' | 'other'

export const finishedReviews = (s: Pick<EditorSubmission, 'reviews'>) => (s.reviews ?? []).filter((r) => r.completed_at).length

/** Where a package stands in the workflow, from its status, its reviews and whether it was released. */
export function caseStage(s: Pick<EditorSubmission, 'status' | 'reviews' | 'publication'>): CaseStage {
  if (s.publication?.status === 'retracted') return 'retracted'
  if (s.publication) return 'released'
  switch (s.status) {
    case 'submitted':
      return 'triage'
    case 'in_review':
      return finishedReviews(s) > 0 ? 'ready_for_decision' : 'under_review'
    case 'revision_requested':
      return 'revisions_pending'
    case 'approved':
      return 'approved'
    case 'rejected':
      return 'rejected'
    default:
      return 'other'
  }
}

export type Waiting = 'editor_assign' | 'reviewers' | 'editor_decide' | 'authors' | 'editor_release' | null

/** Who has to act next. */
export function waitingOn(stage: CaseStage): Waiting {
  switch (stage) {
    case 'triage':
      return 'editor_assign'
    case 'under_review':
      return 'reviewers'
    case 'ready_for_decision':
      return 'editor_decide'
    case 'revisions_pending':
      return 'authors'
    case 'approved':
      return 'editor_release'
    default:
      return null
  }
}

/** A decision can be made while the package is waiting or under review. The server would allow it at any time. */
export const canDecide = (s: Pick<EditorSubmission, 'status' | 'publication'>) => !s.publication && (s.status === 'submitted' || s.status === 'in_review')

/** Approval needs at least one finished review (the server refuses otherwise unless it is overridden, which this screen never does). */
export const canApprove = (s: Pick<EditorSubmission, 'reviews'>) => finishedReviews(s) > 0

export const canRelease = (s: Pick<EditorSubmission, 'status' | 'publication'>) => s.status === 'approved' && !s.publication

export const ageDays = (iso: string | null | undefined, now: number): number | null => {
  const at = iso ? Date.parse(iso) : NaN
  return Number.isFinite(at) ? Math.max(0, Math.floor((now - at) / 86_400_000)) : null
}

/** Candidates who can be asked: not blocked by a conflict and not already assigned to this package. */
export function assignable(candidates: readonly Candidate[], assignedIds: ReadonlySet<number>) {
  return candidates.filter((c) => !c.coi?.blocked && !assignedIds.has(c.id))
}

/** Words typed to find a candidate: any part of the name or affiliation, ignoring case. */
export const matchesCandidate = (c: Candidate, term: string) => {
  const t = term.trim().toLowerCase()
  return t === '' || `${c.display_name ?? ''} ${c.affiliation ?? ''}`.toLowerCase().includes(t)
}

/** The earliest day a review may be due: tomorrow, as a plain day (the server wants a date after today). */
export function tomorrow(now: number): string {
  const d = new Date(now + 86_400_000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Releasing is typed out: the code of the package, so it cannot be done by a stray click. */
export const releaseConfirmed = (typed: string, code: string) => typed.trim().toUpperCase() === code.toUpperCase()
