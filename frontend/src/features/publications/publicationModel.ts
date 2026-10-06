import type { PublicPublication } from '@/api/schemas/publication'

/**
 * Whether an identifier is a DOI someone could resolve. The server makes up `10.5281/openhadith.…` when an editor gives
 * none (request file C-30); that is an internal identifier and must not be shown as a DOI.
 */
export function isRegisteredDoi(doi: string | null | undefined): boolean {
  if (!doi) return false
  return /^10\.\d{4,9}\/\S+$/.test(doi) && !doi.startsWith('10.5281/openhadith.')
}

/** The researchers credited: only the project's owner, by name, until the platform records authors (C-29, C-32). */
export const authorsOf = (p: Pick<PublicPublication, 'project'>): string[] => (p.project?.owner?.display_name ? [p.project.owner.display_name] : [])

/** How many peer reviews were finished. Reviewers' names, aliases and comments are never public here. */
export const finishedReviewCount = (p: Pick<PublicPublication, 'submission'>) => (p.submission?.reviews ?? []).filter((r) => r.submitted_at).length

export type PublicationNotice = 'retracted' | 'corrected' | null

export const noticeOf = (p: Pick<PublicPublication, 'status' | 'corrigenda'>): PublicationNotice =>
  p.status === 'retracted' ? 'retracted' : (p.corrigenda ?? []).length > 0 ? 'corrected' : null

/** The author-and-year line for a plain citation, from what the page shows. */
export function citeAs(p: PublicPublication): string {
  const authors = authorsOf(p).join(' & ')
  const year = p.released_at ? new Date(p.released_at).getUTCFullYear() : null
  return [authors || null, year ? `(${year})` : null, p.title, p.version_string ? `v${p.version_string}` : null].filter(Boolean).join('. ')
}
