import type { SearchRun } from '@/api/schemas/search'
import type { Subscription } from '@/api/schemas/searchCompare'

export const LISTS = ['added', 'removed', 'kept'] as const
export type CompareList = (typeof LISTS)[number]
export const PAGE_SIZE = 10

/** The runs of one saved query, oldest first; a run that did not complete has no comparable hit list and is left out. */
export function comparableRuns(runs: readonly SearchRun[], queryId: number): SearchRun[] {
  return runs
    .filter((r) => r.saved_query_id === queryId && r.status === 'completed')
    .sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')) || a.id - b.id)
}

/** "Earlier" must come before "later"; if the two were chosen the other way round, they are swapped. */
export function inOrder(a: SearchRun, b: SearchRun): [SearchRun, SearchRun] {
  const after = (String(a.created_at ?? '') > String(b.created_at ?? '')) || (a.created_at === b.created_at && a.id > b.id)
  return after ? [b, a] : [a, b]
}

/** Whether the corpus changed between the runs, from the version each run recorded. Unknown if either did not record one. */
export function corpusChange(earlier: Pick<SearchRun, 'corpus_version'>, later: Pick<SearchRun, 'corpus_version'>): 'same' | 'changed' | 'unknown' {
  const a = (earlier.corpus_version ?? '').trim()
  const b = (later.corpus_version ?? '').trim()
  if (!a || !b) return 'unknown'
  return a === b ? 'same' : 'changed'
}

export function pageOf<T>(ids: readonly T[], page: number): T[] {
  const start = (Math.max(1, page) - 1) * PAGE_SIZE
  return ids.slice(start, start + PAGE_SIZE)
}

export const totalPages = (count: number): number => Math.max(1, Math.ceil(count / PAGE_SIZE))

/** The signed-in person's subscription to this query, if any, and everyone else's that is switched on. */
export function splitSubscriptions(subs: readonly Subscription[], queryId: number, myId: number | undefined): { mine: Subscription | null; others: Subscription[] } {
  const forQuery = subs.filter((s) => s.saved_query_id === queryId)
  return { mine: forQuery.find((s) => s.user_id === myId) ?? null, others: forQuery.filter((s) => s.user_id !== myId && s.is_active) }
}

/** Whether the saved query itself was edited between the two runs (each run records the version it ran). Unknown if either did not. */
export function queryEdited(earlier: Pick<SearchRun, 'query_version'>, later: Pick<SearchRun, 'query_version'>): 'same' | 'edited' | 'unknown' {
  if (earlier.query_version == null || later.query_version == null) return 'unknown'
  return earlier.query_version === later.query_version ? 'same' : 'edited'
}
