import { z } from 'zod'
import { ApiError } from './errors'
import { api } from './http'
import {
  addToProjectsResultSchema,
  libraryCollectionSchema,
  libraryCountsSchema,
  libraryItemSchema,
  sharePreviewSchema,
  type LibraryNote,
  type ShareOptions,
} from './schemas/library'

export interface LibraryQuery {
  q?: string
  is_favourite?: boolean
  collection_id?: number
  resource_type?: string
  tag?: string
  saved_from?: string
  page?: number
  per_page?: number
}

export const libraryManageKeys = {
  list: (q: LibraryQuery) => ['library', 'list', q] as const,
  item: (id: number) => ['library', 'item', id] as const,
  collections: ['library', 'collections'] as const,
  tags: ['library', 'tags'] as const,
  preview: (id: number, projects: number[], share: ShareOptions) =>
    ['library', 'share-preview', id, projects, share] as const,
}

export async function listLibrary(query: LibraryQuery = {}, signal?: AbortSignal) {
  const res = await api('/library/items', {
    query: { ...query },
    schema: z.array(libraryItemSchema),
    signal,
  })
  const counts = libraryCountsSchema.safeParse(res.meta.counts)
  return { items: res.data, pagination: res.pagination, counts: counts.success ? counts.data : null }
}

export async function getLibraryItem(id: number, signal?: AbortSignal) {
  const { data } = await api(`/library/items/${id}`, { schema: libraryItemSchema, signal })
  return data
}

/**
 * Tags and notes are stored in columns the backend currently ignores on save (request file C-13), and it
 * answers 200 anyway. Every write below compares the response with what was asked for, and throws
 * NOT_PERSISTED when the server did not keep it, so the screen never claims a save that did not happen.
 */
export type PersistedField = 'favourite' | 'tags' | 'note'

function notPersisted(what: PersistedField): ApiError {
  return new ApiError({
    status: 200,
    code: 'NOT_PERSISTED',
    message: `The server did not keep your ${what}.`,
    details: { what },
  })
}

export async function setFavourite(id: number, isFavourite: boolean) {
  const { data } = await api(`/library/items/${id}`, {
    method: 'PATCH',
    body: { is_favourite: isFavourite },
    schema: libraryItemSchema,
  })
  if ((data.is_favourite ?? false) !== isFavourite) throw notPersisted('favourite')
  return data
}

export async function setTags(id: number, tags: string[]) {
  const { data } = await api(`/library/items/${id}/tags`, {
    method: 'PUT',
    body: { tags },
    schema: libraryItemSchema.pick({ id: true, tags: true }),
  })
  const got = new Set(data.tags ?? [])
  const want = new Set(tags)
  if (got.size !== want.size || [...want].some((t) => !got.has(t))) throw notPersisted('tags')
  return data.tags ?? []
}

export async function setNotes(id: number, notes: LibraryNote[]) {
  const { data } = await api(`/library/items/${id}`, {
    method: 'PATCH',
    body: { notes },
    schema: libraryItemSchema,
  })
  if ((data.notes ?? []).length !== notes.length) throw notPersisted('note')
  return data
}

export async function removeLibraryItem(id: number) {
  await api(`/library/items/${id}`, { method: 'DELETE' })
}

export async function listCollections(signal?: AbortSignal) {
  const { data } = await api('/library/collections', {
    schema: z.array(libraryCollectionSchema),
    signal,
  })
  return data
}

export async function createCollection(name: string) {
  const { data } = await api('/library/collections', {
    method: 'POST',
    body: { name },
    schema: libraryCollectionSchema,
  })
  return data
}

/** Collections hold the resource, not the library entry: one source in many collections. */
export async function addToCollection(collectionId: number, resourceId: number) {
  await api(`/library/collections/${collectionId}/items`, {
    method: 'POST',
    body: { resource_id: resourceId },
  })
}

export async function removeFromCollection(collectionId: number, resourceId: number) {
  await api(`/library/collections/${collectionId}/items/${resourceId}`, { method: 'DELETE' })
}

export async function listTags(signal?: AbortSignal) {
  const { data } = await api('/library/tags', { schema: z.array(z.string()), signal })
  return data
}

export async function sharePreview(id: number, projectIds: number[], share: ShareOptions) {
  const { data } = await api(`/library/items/${id}/share-preview`, {
    method: 'POST',
    body: { project_ids: projectIds, share },
    schema: sharePreviewSchema,
  })
  return data
}

export async function addToProjects(id: number, projectIds: number[], share: ShareOptions) {
  const { data } = await api(`/library/items/${id}/add-to-projects`, {
    method: 'POST',
    body: { project_ids: projectIds, share },
    schema: addToProjectsResultSchema,
  })
  return data
}
