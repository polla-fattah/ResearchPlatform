import type { ChapterOutline } from '@/api/schemas/bookStructure'
import { normalizeArabic } from '@/features/comparison/comparisonModel'

export const bookCode = (id: number) => `BK-${String(id).padStart(4, '0')}`

/** The server accepts 2 to 100 characters. */
export const TERM_MIN = 2
export const TERM_MAX = 100
export const validTerm = (raw: string): boolean => raw.trim().length >= TERM_MIN && raw.trim().length <= TERM_MAX

/** Chapters whose title contains the typed text, ignoring vowel marks and letter variants. Order is kept. */
export function filterChapters(chapters: readonly ChapterOutline[], text: string): ChapterOutline[] {
  const wanted = normalizeArabic(text).toLowerCase()
  if (!wanted) return [...chapters]
  return chapters.filter((c) => normalizeArabic(c.chapter_title ?? '').toLowerCase().includes(wanted))
}

/** A chapter with no title is shown by its position, never as an empty line. */
export const chapterLabel = (c: ChapterOutline, position: number): string => (c.chapter_title ?? '').trim() || `#${position}`

/** `total_matches` is the rows returned. When it reaches the limit there may be more that the server did not return. */
export const maybeMore = (returned: number, limit: number): boolean => returned >= limit

/** The books the sampled rows came from, most rows first; ties keep the server's order. */
export function distributionRows(dist: Record<string, number>): { book: string; count: number }[] {
  return Object.entries(dist)
    .map(([book, count]) => ({ book, count }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Whether the snippet really contains the word form. The server cuts the snippet around the match when it finds one in
 * the vowelled text; when it does not, it sends the first 100 characters instead, which is not "in context".
 */
export function snippetShowsTerm(snippet: string, term: string): boolean {
  const wanted = normalizeArabic(term)
  return wanted !== '' && normalizeArabic(snippet.replace(/\.\.\./g, ' ')).includes(wanted)
}

export function excerpt(text: string | null | undefined, max = 220): string {
  const t = (text ?? '').trim()
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t
}
