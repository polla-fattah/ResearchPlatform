import { z } from 'zod'
import { ApiError } from './errors'
import { api } from './http'
import { libraryItemSchema, type LibraryItem, type SaveLibraryInput } from './schemas/library'

/** The first 100 saved items. The picker uses it to mark corpus results that are already saved. */
export async function listLibraryItems(signal?: AbortSignal) {
  const { data } = await api('/library/items', {
    query: { per_page: 100 },
    schema: z.array(libraryItemSchema),
    signal,
  })
  return data
}

export type SaveOutcome =
  | { kind: 'saved'; item: LibraryItem }
  | { kind: 'duplicate'; existing: LibraryItem | null }

/** A 409 DUPLICATE is a normal outcome here (the researcher decides what to do), not an error. */
export async function saveLibraryItem(input: SaveLibraryInput): Promise<SaveOutcome> {
  try {
    const { data } = await api('/library/items', {
      method: 'POST',
      body: input,
      schema: libraryItemSchema,
    })
    return { kind: 'saved', item: data }
  } catch (err) {
    if (err instanceof ApiError && err.status === 409 && err.code === 'DUPLICATE') {
      const details = err.details as { existing_item?: unknown } | undefined
      const parsed = libraryItemSchema.safeParse(details?.existing_item)
      return { kind: 'duplicate', existing: parsed.success ? parsed.data : null }
    }
    throw err
  }
}

/** Adds a resource to a project's bibliography. Idempotent on the server (no error if already attached). */
export async function attachResourceToProject(
  projectId: number,
  resourceId: number,
  inclusionRationale?: string,
) {
  await api(`/projects/${projectId}/resources`, {
    method: 'POST',
    body: { resource_id: resourceId, inclusion_rationale: inclusionRationale },
  })
}
