import { z } from 'zod'
import { api } from './http'
import {
  corpusBookSchema,
  corpusCriticismSchema,
  corpusHadithSchema,
  corpusNarratorSchema,
  corpusSearchHitSchema,
} from './schemas/corpus'

export interface CorpusSearchParams {
  q?: string
  /** `fts` is the backend default; the design only exposes exact and normalized. */
  mode?: 'fts' | 'trgm' | 'normalized' | 'exact'
  book_id?: number
  chapter_id?: number
  hukm_id?: number
  narrator_id?: number
  page?: number
  per_page?: number
}

export async function searchCorpus(params: CorpusSearchParams, signal?: AbortSignal) {
  return api('/corpus/search', {
    query: { ...params },
    schema: z.array(corpusSearchHitSchema),
    signal,
  })
}

export async function getHadith(id: number, signal?: AbortSignal) {
  const { data } = await api(`/corpus/hadiths/${id}`, { schema: corpusHadithSchema, signal })
  return data
}

export async function getNarrator(id: number, signal?: AbortSignal) {
  const { data } = await api(`/corpus/narrators/${id}`, { schema: corpusNarratorSchema, signal })
  return data
}

export async function getNarratorCriticism(id: number, page = 1, signal?: AbortSignal) {
  return api(`/corpus/narrators/${id}/criticism`, {
    query: { page },
    schema: z.array(corpusCriticismSchema),
    signal,
  })
}

/** The narrator's teachers (shyookh) or students, one page of the corpus's recorded links. */
export async function getNarratorLinks(id: number, kind: 'teachers' | 'students', signal?: AbortSignal) {
  return api(`/corpus/narrators/${id}/${kind}`, { query: { per_page: 8 }, schema: z.array(corpusNarratorSchema), signal })
}

export async function listBooks(page = 1, per_page = 20, signal?: AbortSignal) {
  return api('/corpus/books', {
    query: { page, per_page },
    schema: z.array(corpusBookSchema),
    signal,
  })
}

export async function listNarrators(q: string, signal?: AbortSignal) {
  const { data } = await api('/corpus/narrators', {
    query: { q, per_page: 8 },
    schema: z.array(corpusNarratorSchema),
    signal,
  })
  return data
}
