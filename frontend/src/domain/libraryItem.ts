import type { LibraryItem } from '@/api/schemas/library'
import { formatCode, type CodePrefix } from './codes'

/** What a saved item is, whichever spelling the backend stored (see RESOURCE_TYPES). */
export type LibraryKind =
  | 'report'
  | 'occurrence'
  | 'narrator'
  | 'book'
  | 'judgment'
  | 'chain'
  | 'external'
  | 'other'

const BY_TYPE: Record<string, LibraryKind> = {
  corpus_hadith: 'report',
  hadith: 'report',
  hadith_reference: 'occurrence',
  corpus_narrator: 'narrator',
  narrator: 'narrator',
  corpus_book: 'book',
  book: 'book',
  alem_qawl_detail: 'judgment',
  sanad: 'chain',
  external: 'external',
  article: 'external',
  manuscript: 'external',
}

export function kindOf(resourceType: string): LibraryKind {
  return BY_TYPE[resourceType] ?? 'other'
}

/** The resource_type values to send for each kind when filtering. Several spellings exist per kind. */
export const FILTER_TYPES: { kind: LibraryKind; value: string }[] = [
  { kind: 'report', value: 'corpus_hadith' },
  { kind: 'occurrence', value: 'hadith_reference' },
  { kind: 'narrator', value: 'corpus_narrator' },
  { kind: 'book', value: 'corpus_book' },
  { kind: 'external', value: 'external' },
]

const PREFIX: Record<Exclude<LibraryKind, 'judgment' | 'other'>, CodePrefix> = {
  report: 'REP',
  occurrence: 'OCC',
  narrator: 'NAR',
  book: 'BK',
  chain: 'CH',
  external: 'EXT',
}

/**
 * Display code for a saved item, built from the corpus id when there is one.
 * Seeded rows have no corpus id, so they get a LIB code from the library entry id instead.
 */
export function libraryCode(item: Pick<LibraryItem, 'id' | 'resource'>): string {
  const kind = kindOf(item.resource.resource_type)
  const corpusId = item.resource.corpus_id
  if (kind === 'external') return formatCode('EXT', item.resource.id)
  if (kind !== 'judgment' && kind !== 'other' && corpusId) return formatCode(PREFIX[kind], corpusId)
  return formatCode('LIB', item.id)
}

/** The original wording saved with the item, when a snapshot exists. */
export function snapshotText(item: Pick<LibraryItem, 'snapshot_data' | 'excerpt_text'>): string | null {
  if (item.excerpt_text) return item.excerpt_text
  const snap = item.snapshot_data
  if (snap && typeof snap === 'object' && 'matn' in snap && typeof snap.matn === 'string') return snap.matn
  return null
}

/** Short line under the title in the list. */
export function shortLocator(item: Pick<LibraryItem, 'locator' | 'resource'>): string {
  if (item.locator) return item.locator
  const meta = item.resource.source_metadata
  if (meta && typeof meta === 'object' && 'locator' in meta && typeof meta.locator === 'string') return meta.locator
  return item.resource.author ?? ''
}
