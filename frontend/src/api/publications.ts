import { z } from 'zod'
import { api } from './http'
import { citationSchema, publicPublicationSchema, type CitationFormat } from './schemas/publication'

export const PUBLICATIONS_PER_PAGE = 12

export interface PublicationQuery {
  q?: string
  status?: 'retracted'
  page?: number
}

/** Released publications. The server lists `published` unless a status is asked for. */
export async function listPublications(query: PublicationQuery = {}, signal?: AbortSignal) {
  const res = await api('/public/research', { query: { ...query, per_page: PUBLICATIONS_PER_PAGE }, schema: z.array(publicPublicationSchema), signal })
  return { items: res.data, pagination: res.pagination }
}

/** One publication by its address; anything not released looks the same as an address that never existed. */
export async function getPublication(slug: string, signal?: AbortSignal) {
  const { data } = await api(`/public/research/${encodeURIComponent(slug)}`, { schema: publicPublicationSchema, signal })
  return data
}

/**
 * A formatted citation. The server's route has no format segment, so `format` in the query may be ignored and BibTeX
 * answered whatever was asked (request file C-32); the answer says which format it is, and the page shows that one.
 */
export async function getCitation(slug: string, format: CitationFormat, signal?: AbortSignal) {
  const { data } = await api(`/public/research/${encodeURIComponent(slug)}/cite`, { query: { format }, schema: citationSchema, signal })
  return data
}
