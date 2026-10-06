import { z } from 'zod'
import { ApiError } from './errors'
import { api } from './http'
import { savedQuerySchema } from './schemas/search'
import type { QueryDefinition } from './searchWorkspace'

/** The account's own saved searches: only the person can see them, in no project. */
export async function listPersonalSearches(page = 1, signal?: AbortSignal) {
  const res = await api('/saved-searches', { query: { page, per_page: 20 }, schema: z.array(savedQuerySchema), signal })
  return { items: res.data, pagination: res.pagination }
}

export async function createPersonalSearch(def: QueryDefinition) {
  const { data } = await api('/saved-searches', { method: 'POST', body: def, schema: savedQuerySchema })
  return data
}

/** Renames a search. The answer is compared with what was asked, so a name the server did not keep is reported. */
export async function renamePersonalSearch(id: number, name: string) {
  const { data } = await api(`/saved-searches/${id}`, { method: 'PATCH', body: { name }, schema: savedQuerySchema })
  if (data.name !== name) {
    throw new ApiError({ status: 200, code: 'NOT_PERSISTED', message: 'The server did not keep the name.', details: { what: 'name' } })
  }
  return data
}

export async function deletePersonalSearch(id: number) {
  await api(`/saved-searches/${id}`, { method: 'DELETE' })
}
