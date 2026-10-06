import { z } from 'zod'

/**
 * resource_type values. The backend accepts several spellings; existing rows use the `corpus_*`
 * names (seeded data), so the picker keeps those for reports, narrators and books.
 */
export const RESOURCE_TYPES = {
  report: { resource_type: 'corpus_hadith', corpus_table: 'hadiths' },
  occurrence: { resource_type: 'hadith_reference', corpus_table: 'hadith_references' },
  narrator: { resource_type: 'corpus_narrator', corpus_table: 'narrators' },
  book: { resource_type: 'corpus_book', corpus_table: 'books' },
  external: { resource_type: 'external', corpus_table: null },
} as const

/**
 * The backend stores tags, notes and flags in JSON columns without casts, so they arrive as the
 * string "[]" instead of an array (request file C-13). Accept both, so a backend fix changes nothing here.
 */
export const jsonList = <T extends z.ZodType>(item: T) =>
  z.preprocess((v) => {
    if (typeof v === 'string') {
      try {
        return JSON.parse(v) as unknown
      } catch {
        return []
      }
    }
    return v ?? []
  }, z.array(item))

export const libraryResourceSchema = z.object({
  id: z.number(),
  resource_type: z.string(),
  corpus_table: z.string().nullable().optional(),
  corpus_id: z.number().nullable().optional(),
  title: z.string(),
  author: z.string().nullable().optional(),
  source_metadata: z.unknown().optional(),
  collections: z.array(z.object({ id: z.number(), name: z.string() })).optional(),
})

export const libraryNoteSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  text: z.string(),
  direction: z.enum(['ltr', 'rtl']).optional(),
  created_at: z.string().nullable().optional(),
})
export type LibraryNote = z.infer<typeof libraryNoteSchema>

export const libraryItemSchema = z.object({
  id: z.number(),
  resource_id: z.number(),
  is_favourite: z.boolean().optional(),
  personal_notes: z.string().nullable().optional(),
  locator: z.string().nullable().optional(),
  excerpt_text: z.string().nullable().optional(),
  snapshot_data: z.unknown().optional(),
  snapshot_corpus_version: z.string().nullable().optional(),
  /** current | changed | merged | removed */
  source_status: z.string().nullable().optional(),
  merged_into: z.string().nullable().optional(),
  incomplete_citation_flags: jsonList(z.string()).optional(),
  tags: jsonList(z.string()).optional(),
  notes: jsonList(libraryNoteSchema).optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  resource: libraryResourceSchema,
})
export type LibraryItem = z.infer<typeof libraryItemSchema>

export const libraryCollectionSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable().optional(),
  resources_count: z.number().optional(),
})
export type LibraryCollection = z.infer<typeof libraryCollectionSchema>

export const libraryCountsSchema = z.object({
  total_saved: z.number(),
  favourites_count: z.number(),
  collections_count: z.number(),
})
export type LibraryCounts = z.infer<typeof libraryCountsSchema>

/** Per-project outcome of POST /library/items/{id}/add-to-projects. */
export const addToProjectsResultSchema = z.array(
  z.object({
    project_id: z.number(),
    status: z.string(), // added | already_in_project | forbidden | project_not_found
    project_resource_id: z.number().optional(),
  }),
)

export const sharePreviewSchema = z.array(
  z.object({
    project_id: z.number(),
    project_title: z.string(),
    already_in_project: z.boolean(),
    will_include: z.object({
      resource: z.boolean(),
      locator: z.boolean(),
      excerpt: z.boolean(),
      tags: z.boolean(),
      notes: z.boolean(),
    }),
  }),
)

/** What the picker sends to POST /library/items. */
export interface SaveLibraryInput {
  resource_type: string
  corpus_table?: string | null
  corpus_id?: number | null
  title: string
  author?: string | null
  source_metadata?: Record<string, unknown>
  locator?: string | null
  excerpt_text?: string | null
  snapshot_data?: Record<string, unknown> | null
  incomplete_citation_flags?: string[]
  /** Only after the researcher chose "save a distinct excerpt". */
  allow_duplicate_excerpt?: boolean
}

export interface ShareOptions {
  excerpt: boolean
  tags: boolean
  notes: boolean
}
