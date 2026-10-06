import { z } from 'zod'
import { api, type Pagination } from '@/api/http'
import { getHadith, searchCorpus } from '@/api/corpus'
import {
  corpusNarratorSchema,
  type CorpusHadith,
  type CorpusSearchHit,
} from '@/api/schemas/corpus'
import { parseCode } from '@/domain/codes'
import {
  pickableFromNarrator,
  pickablesFromHit,
  type Pickable,
  type PickableKind,
} from '@/domain/pickable'
import { getNarrator } from '@/api/corpus'

/** The kinds the picker can find today. Book, chapter, chain and judgment need backend search (request file C-13). */
export const SEARCHABLE: readonly PickableKind[] = ['report', 'occurrence', 'narrator']

export interface PickerSearch {
  q: string
  /** '' means everything searchable. */
  kind: PickableKind | ''
  page: number
}

export interface PickerResults {
  items: Pickable[]
  /** Pagination of the hadith search (narrators are shown on page 1 only). */
  pagination?: Pagination
  exactCode: boolean
}

/** A report fetched by id, reshaped like a search hit so it flows through the same adapters. */
function hitFromDetail(h: CorpusHadith): CorpusSearchHit {
  const refs = h.references ?? []
  return {
    ...h,
    occurrences_count: refs.length,
    occurrences: refs.map((r) => ({
      id: r.id,
      book: r.book ? { id: r.book.id, title: r.book.title, edition: r.book.edition, author: r.book.author ?? null } : null,
      hadith_number: r.hadith_number ?? null,
      page_number: r.page_number ?? null,
      volume: null,
      edition: r.book?.edition ?? null,
      chapter: null,
    })),
  }
}

async function searchNarrators(q: string, signal?: AbortSignal) {
  const { data } = await api('/corpus/narrators', {
    query: { q, per_page: 10 },
    schema: z.array(corpusNarratorSchema),
    signal,
  })
  return data
}

/** "Matches titles, IDs and narrator names exactly as written": REP-/NAR- codes open that record directly. */
export async function searchPickables(s: PickerSearch, signal?: AbortSignal): Promise<PickerResults> {
  const code = parseCode(s.q)
  if (code?.prefix === 'REP') {
    const report = await getHadith(code.id, signal)
    return { items: pickablesFromHit(hitFromDetail(report)), exactCode: true }
  }
  if (code?.prefix === 'NAR') {
    return { items: [pickableFromNarrator(await getNarrator(code.id, signal))], exactCode: true }
  }

  const wantsHadith = s.kind === '' || s.kind === 'report' || s.kind === 'occurrence'
  const wantsNarrators = s.kind === '' || s.kind === 'narrator'

  const [hadith, narrators] = await Promise.all([
    wantsHadith ? searchCorpus({ q: s.q, page: s.page, per_page: 10 }, signal) : null,
    wantsNarrators && s.page === 1 ? searchNarrators(s.q, signal) : null,
  ])

  let items: Pickable[] = (hadith?.data ?? []).flatMap(pickablesFromHit)
  if (s.kind === 'report') items = items.filter((p) => p.kind === 'report')
  if (s.kind === 'occurrence') items = items.filter((p) => p.kind === 'occurrence')
  items = [...items, ...(narrators ?? []).map(pickableFromNarrator)]
  return { items, pagination: hadith?.pagination, exactCode: false }
}
