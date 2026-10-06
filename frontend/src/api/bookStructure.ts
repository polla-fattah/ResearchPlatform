import { api } from './http'
import { concordanceSchema, structureSchema } from './schemas/bookStructure'

export async function getStructure(bookId: number, signal?: AbortSignal) {
  const { data } = await api(`/corpus/books/${bookId}/structure`, { schema: structureSchema, signal })
  return data
}

export const CONCORDANCE_LIMITS = [50, 100, 200] as const

/** Places a word form appears in the corpus, optionally within one book. The term is 2 to 100 characters. */
export async function getConcordance(term: string, bookId: number | null, limit: number, signal?: AbortSignal) {
  const { data } = await api('/corpus/concordance', { query: { q: term, book_id: bookId ?? undefined, limit }, schema: concordanceSchema, signal })
  return data
}
