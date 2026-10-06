import type { CorpusNarrator, CorpusSearchHit, CorpusOccurrence } from '@/api/schemas/corpus'
import { RESOURCE_TYPES, type SaveLibraryInput } from '@/api/schemas/library'
import { formatCode } from './codes'

/**
 * Something the resource picker can save: a report record, one occurrence of it in a book, or a
 * narrator. Built from corpus responses; nothing here invents data. A missing page stays "Unknown".
 */
export type PickableKind = 'report' | 'occurrence' | 'narrator'

export interface Pickable {
  /** Unique within a result list, e.g. "occurrence:233621". */
  key: string
  kind: PickableKind
  corpusId: number
  code: string
  title: string
  /** Short location line under the title. */
  loc: string
  /** Full citation-style locator. Parts that are not recorded say "Unknown". */
  locator: string
  /** Locator parts the corpus does not record; they become Incomplete citation flags. */
  gaps: string[]
  /** Original wording, exactly as stored (never normalised). */
  text: string | null
  /** True when an occurrence is showing its report's text because its own wording is not recorded. */
  textIsReportLevel: boolean
  /** Fields for POST /library/items. */
  save: Pick<
    SaveLibraryInput,
    'resource_type' | 'corpus_table' | 'corpus_id' | 'title' | 'author' | 'source_metadata' | 'snapshot_data'
  >
}

/** English plural for strings built here. Localising corpus labels is planned for Phase 5. */
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s)
const authorName = (a: CorpusOccurrence['book']): string | null => {
  const author = a?.author
  if (!author) return null
  return typeof author === 'string' ? author : author.name
}

export function pickableFromOccurrence(hit: CorpusSearchHit, occ: CorpusOccurrence): Pickable {
  const book = occ.book
  const volume = occ.volume ?? null
  const page = occ.page_number ?? null
  const edition = occ.edition ?? book?.edition ?? null
  const number = occ.hadith_number ?? null

  const gaps: string[] = []
  if (page === null) gaps.push('page')
  if (number === null) gaps.push('source number')

  const title = [
    book?.title,
    occ.chapter?.title ?? null,
    number !== null ? `ḥadīth ${number}` : null,
  ]
    .filter(Boolean)
    .join(', ')

  const locParts = [
    volume !== null ? `Vol. ${volume}` : null,
    page !== null ? `p. ${page}` : 'page unknown',
  ].filter(Boolean)

  return {
    key: `occurrence:${occ.id}`,
    kind: 'occurrence',
    corpusId: occ.id,
    code: formatCode('OCC', occ.id),
    title: title || formatCode('OCC', occ.id),
    loc: locParts.join(' · '),
    locator: [
      book?.title,
      edition,
      volume !== null ? `vol. ${volume}` : null,
      page !== null ? `p. ${page}` : 'page: Unknown',
      number !== null ? `source no. ${number}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    gaps,
    text: hit.matn,
    textIsReportLevel: true,
    save: {
      ...RESOURCE_TYPES.occurrence,
      corpus_id: occ.id,
      title: title || formatCode('OCC', occ.id),
      author: authorName(book),
      source_metadata: {
        book: book?.title,
        chapter: occ.chapter?.title,
        locator: `${volume !== null ? `vol. ${volume}, ` : ''}${page !== null ? `p. ${page}` : 'page unknown'}`,
        hadith_number: number,
        hadith_id: hit.id,
      },
      snapshot_data: { matn: hit.matn, hadith_id: hit.id, occurrence_id: occ.id },
    },
  }
}

export function pickablesFromHit(hit: CorpusSearchHit): Pickable[] {
  const occurrences = hit.occurrences ?? []
  const books = new Set(occurrences.map((o) => o.book?.id).filter((x) => x !== undefined))
  const matn = hit.matn ?? ''
  const report: Pickable = {
    key: `report:${hit.id}`,
    kind: 'report',
    corpusId: hit.id,
    code: formatCode('REP', hit.id),
    title: `Report: ${truncate(matn, 80) || formatCode('REP', hit.id)}`,
    loc: `${plural(hit.occurrences_count ?? occurrences.length, 'occurrence')} in ${plural(books.size, 'book')}`,
    locator: `Report-level record ${formatCode('REP', hit.id)}`,
    gaps: [],
    text: hit.matn,
    textIsReportLevel: false,
    save: {
      ...RESOURCE_TYPES.report,
      corpus_id: hit.id,
      title: `Report: ${truncate(matn, 120) || formatCode('REP', hit.id)}`,
      author: null,
      source_metadata: { occurrences: hit.occurrences_count ?? occurrences.length },
      snapshot_data: { matn: hit.matn },
    },
  }
  return [report, ...occurrences.map((o) => pickableFromOccurrence(hit, o))]
}

export function pickableFromNarrator(n: CorpusNarrator): Pickable {
  const died = n.deathdate ? ` (d. ${n.deathdate} AH)` : ''
  const title = `${n.name}${died}`
  return {
    key: `narrator:${n.id}`,
    kind: 'narrator',
    corpusId: n.id,
    code: formatCode('NAR', n.id),
    title,
    loc: [n.kunya, n.laqab].filter(Boolean).join(' · ') || 'Identity record',
    locator: `Narrator identity ${formatCode('NAR', n.id)}`,
    gaps: [],
    text: null,
    textIsReportLevel: false,
    save: {
      ...RESOURCE_TYPES.narrator,
      corpus_id: n.id,
      title,
      author: null,
      source_metadata: { kunya: n.kunya, laqab: n.laqab, deathdate: n.deathdate },
      snapshot_data: { name: n.name, rutba_description: n.rutba_description },
    },
  }
}

/** Key used to match a saved library item against a result. */
export const savedKey = (corpusTable: string | null | undefined, corpusId: number | null | undefined) =>
  corpusTable && corpusId ? `${corpusTable}:${corpusId}` : null

export const pickableSavedKey = (p: Pickable) => savedKey(p.save.corpus_table, p.save.corpus_id)
