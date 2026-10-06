import type { Issue, Submission } from '@/api/schemas/submission'

export const LICENCES = ['CC-BY-4.0', 'CC-BY-NC-4.0', 'All rights reserved'] as const

/** The newest package: the highest version. */
export const latestOf = (items: readonly Submission[]): Submission | null =>
  items.reduce<Submission | null>((best, s) => (best === null || s.version_number > best.version_number ? s : best), null)

/**
 * What the author may do next. A new package follows a revision request (it answers it) or the first submission;
 * while one is waiting, under review, approved or rejected, the screen offers none.
 */
export type NextStep = 'first' | 'respond' | 'wait' | 'closed'
export function nextStep(latest: Submission | null): NextStep {
  if (!latest) return 'first'
  if (latest.status === 'revision_requested') return 'respond'
  if (latest.status === 'rejected' || latest.status === 'approved') return 'closed'
  return 'wait'
}

export const completedReviews = (s: Pick<Submission, 'reviews'>) => (s.reviews ?? []).filter((r) => r.completed_at).length

export const shortChecksum = (sum: string | null | undefined) => (sum ? sum.slice(0, 12) : '')

/** The title offered first: the chosen document's title when exactly one is chosen, otherwise the project's. */
export const defaultTitle = (projectTitle: string, chosen: readonly { title: string }[]) => (chosen.length === 1 ? (chosen[0]?.title ?? projectTitle) : projectTitle)

export const errorsOf = (issues: readonly Issue[]) => issues.filter((i) => i.severity !== 'warning')
export const warningsOf = (issues: readonly Issue[]) => issues.filter((i) => i.severity === 'warning')

/** Where the person goes to fix an issue, or null when it has no place of its own. */
export function issueHref(projectId: number, issue: Pick<Issue, 'code' | 'document_id'>): string | null {
  const base = `/projects/${projectId}`
  if (issue.code === 'SUSPENDED_PARTICIPANT') return `${base}/members`
  if (issue.document_id) return `${base}/findings?doc=${issue.document_id}`
  if (issue.code === 'NO_DOCUMENTS') return `${base}/findings`
  return null
}

/** Whether the form may be sent: something chosen, an abstract, a licence, both confirmations, no errors, and (for a response) an answer. */
export function canFreeze(v: { documentIds: readonly number[]; title: string; abstract: string; rightsConfirmed: boolean; coiConfirmed: boolean; response: string | null }, issues: readonly Issue[] | null): boolean {
  if (v.documentIds.length === 0) return false
  if (!v.title.trim() || !v.abstract.trim()) return false
  if (!v.rightsConfirmed || !v.coiConfirmed) return false
  if (v.response !== null && !v.response.trim()) return false
  if (issues === null) return false
  return errorsOf(issues).length === 0
}
