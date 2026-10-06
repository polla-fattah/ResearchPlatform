import { RESOURCE_TYPES, type SaveLibraryInput } from '@/api/schemas/library'

export const EXTERNAL_KINDS = ['article', 'book', 'chapter', 'manuscript', 'thesis', 'web'] as const
export type ExternalKind = (typeof EXTERNAL_KINDS)[number]

export interface ExternalReferenceForm {
  kind: ExternalKind
  title: string
  author: string
  date: string
  dateUnknown: boolean
  /** ISO date, defaults to today. */
  accessed: string
  url: string
  identifier: string
  venue: string
  pages: string
}

/**
 * Citation parts that are missing. A missing part is flagged, never guessed (LIB-03):
 * an incomplete reference can still be saved, and carries the flag wherever it is cited.
 */
export function missingParts(f: ExternalReferenceForm): string[] {
  const out: string[] = []
  if (!f.author.trim()) out.push('author')
  if (!f.date.trim()) out.push(f.dateUnknown ? 'publication date (marked unknown)' : 'publication date')
  if (!f.venue.trim()) out.push('publisher or journal')
  if (!f.pages.trim()) out.push('pages')
  return out
}

/** A readable citation made only from what was entered. Gaps show as placeholders. */
export function citationPreview(f: ExternalReferenceForm): string {
  const parts = [
    f.author.trim() || '[Author unknown]',
    f.date.trim() ? `(${f.date.trim()})` : '(n.d.)',
    f.title.trim() ? `“${f.title.trim()}”` : '[Title missing]',
    f.venue.trim(),
    f.pages.trim() ? `pp. ${f.pages.trim()}` : '',
    f.url.trim(),
    `Accessed ${f.accessed || '[date]'}`,
  ].filter(Boolean)
  return parts.join('. ') + '.'
}

export function toSaveInput(f: ExternalReferenceForm): SaveLibraryInput {
  const gaps = missingParts(f)
  return {
    ...RESOURCE_TYPES.external,
    title: f.title.trim(),
    author: f.author.trim() || null,
    source_metadata: {
      kind: f.kind,
      date: f.date.trim() || null,
      date_unknown: f.dateUnknown,
      accessed_at: f.accessed || null,
      url: f.url.trim() || null,
      identifier: f.identifier.trim() || null,
      venue: f.venue.trim() || null,
      pages: f.pages.trim() || null,
    },
    incomplete_citation_flags: gaps,
  }
}

export const emptyExternalReference = (today: string): ExternalReferenceForm => ({
  kind: 'article',
  title: '',
  author: '',
  date: '',
  dateUnknown: false,
  accessed: today,
  url: '',
  identifier: '',
  venue: '',
  pages: '',
})
