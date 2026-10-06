import type { CorpusSearchHit } from '@/api/schemas/corpus'
import type { SavedQuery, SearchFilters } from '@/api/schemas/search'
import { formatCode } from '@/domain/codes'

export type SearchMode = 'exact' | 'normalized'

export const isMode = (v: string | null | undefined): v is SearchMode => v === 'exact' || v === 'normalized'

/** The query as typed: text, mode and filters. This is what a saved search stores. */
export interface Definition {
  q: string
  mode: SearchMode
  filters: SearchFilters
}

export const MIN_QUERY_LENGTH = 2

export const sameDefinition = (a: Definition, b: Definition): boolean =>
  a.q.trim() === b.q.trim() &&
  a.mode === b.mode &&
  (a.filters.hukm_id ?? null) === (b.filters.hukm_id ?? null) &&
  (a.filters.narrator_id ?? null) === (b.filters.narrator_id ?? null)

/** A saved query back into the form. Modes the design does not offer (fts) show as Normalized. */
export function definitionOf(q: SavedQuery): Definition {
  const f = q.filter_criteria ?? {}
  const num = (v: unknown) => (typeof v === 'number' ? v : undefined)
  return {
    q: q.query_text,
    mode: q.search_mode === 'exact' ? 'exact' : 'normalized',
    filters: {
      hukm_id: num(f.hukm_id),
      narrator_id: num(f.narrator_id),
      narrator_label: typeof f.narrator_label === 'string' ? f.narrator_label : undefined,
      book_id: num(f.book_id),
    },
  }
}

/** R-0031-5: the fifth run of saved search SQ-0031. */
export const runCode = (queryId: number, ordinal: number) =>
  `R-${String(queryId).padStart(4, '0')}-${ordinal}`

/** 1-based position of a run among the runs of its saved search, oldest first. 0 when it is not in the list yet. */
export function runOrdinal(runs: { id: number; saved_query_id: number; created_at?: string | null }[], queryId: number, runId: number): number {
  const mine = runs
    .filter((r) => r.saved_query_id === queryId)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || a.id - b.id)
  return mine.findIndex((r) => r.id === runId) + 1
}

export const queryCode = (id: number) => formatCode('SQ', id)

export interface Segment {
  text: string
  hit: boolean
}

/**
 * Splits the ORIGINAL wording into plain and highlighted parts using the character offsets from the
 * API. Offsets count characters (not UTF-16 units), so the text is split by code point.
 * Overlapping or out-of-range offsets are clamped; the text is never changed.
 */
export function segments(text: string, highlights: { start: number; length: number }[] | undefined): Segment[] {
  const chars = Array.from(text)
  const ranges = (highlights ?? [])
    .map((h) => ({ start: Math.max(0, h.start), end: Math.min(chars.length, h.start + h.length) }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start)

  const out: Segment[] = []
  let cursor = 0
  for (const r of ranges) {
    const start = Math.max(r.start, cursor)
    if (r.end <= start) continue
    if (start > cursor) out.push({ text: chars.slice(cursor, start).join(''), hit: false })
    out.push({ text: chars.slice(start, r.end).join(''), hit: true })
    cursor = r.end
  }
  if (cursor < chars.length) out.push({ text: chars.slice(cursor).join(''), hit: false })
  return out.length > 0 ? out : [{ text, hit: false }]
}

/** Short chain description: "4 narrators: A → B → C" (names are as stored; order may be uncertain). */
export function chainLine(summary: NonNullable<CorpusSearchHit['occurrences']>[number]['chain_summary']) {
  // A chain with no narrators recorded is an unknown chain, not an empty one.
  if (!summary || (summary.narrator_count === 0 && summary.first_names.length === 0)) return null
  return { count: summary.narrator_count, names: summary.first_names, uncertain: summary.order_uncertain }
}

/** Keys that identify one selectable thing in the results. */
export const occKey = (id: number) => `occurrence:${id}`

export const WHY_KEYS: Record<string, string> = {
  exact_phrase: 'exact',
  exact: 'exact',
  normalized: 'normalized',
  fts_rank: 'ranked',
  fts: 'ranked',
  trgm: 'similar',
}
