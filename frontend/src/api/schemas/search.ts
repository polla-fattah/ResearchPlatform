import { z } from 'zod'

/** PHP sends an empty array where we expect an object, so accept both and normalise to an object. */
const looseObject = z.preprocess(
  (v) => (Array.isArray(v) || v === null || v === undefined ? {} : v),
  z.record(z.string(), z.unknown()),
)

/** Filters kept with a saved search. Only the keys the corpus search understands are applied. */
export interface SearchFilters {
  hukm_id?: number
  narrator_id?: number
  /** Display name of the narrator, kept so a reopened search can say who it filters by. */
  narrator_label?: string
  book_id?: number
}

export const searchRunSchema = z.object({
  id: z.number(),
  saved_query_id: z.number(),
  corpus_version: z.string().nullable().optional(),
  query_version: z.number().nullable().optional(),
  index_id: z.string().nullable().optional(),
  match_count: z.number().nullable().optional(),
  /** completed | partial | failed | cancelled | running */
  status: z.string(),
  execution_duration_ms: z.number().nullable().optional(),
  created_at: z.string().nullable().optional(),
  progress: z
    .object({
      scanned_books: z.number().optional(),
      total_books: z.number().optional(),
      truncated: z.boolean().optional(),
      total_available: z.number().optional(),
    })
    .nullable()
    .optional(),
  hits: z.array(z.object({ hadith_id: z.number(), ordinal: z.number().optional() })).nullable().optional(),
})
export type SearchRun = z.infer<typeof searchRunSchema>

export const savedQuerySchema = z.object({
  id: z.number(),
  owner_type: z.string().optional(),
  owner_id: z.number().optional(),
  name: z.string(),
  query_text: z.string(),
  search_mode: z.string().nullable().optional(),
  filter_criteria: looseObject.optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  search_runs: z.array(searchRunSchema).optional(),
})
export type SavedQuery = z.infer<typeof savedQuerySchema>

export const runWithQuerySchema = searchRunSchema.extend({
  saved_query: savedQuerySchema.pick({ id: true, name: true, query_text: true, search_mode: true }).optional(),
})

export const runResultSchema = z.object({
  search_run: searchRunSchema,
  truncated: z.boolean().optional(),
  total_available: z.number().optional(),
})

export const resultSetSchema = z.object({
  id: z.number(),
  project_id: z.number(),
  search_run_id: z.number().nullable().optional(),
  name: z.string(),
  is_frozen: z.boolean().optional(),
  total_count: z.number().optional(),
  created_at: z.string().nullable().optional(),
})
export type ResultSet = z.infer<typeof resultSetSchema>

export const compareSchema = z.object({
  summary: z.object({
    common_count: z.number(),
    added_count: z.number(),
    removed_count: z.number(),
  }),
})

export const bulkOutcomeSchema = z.object({
  outcomes: z.array(
    z.object({
      resource_id: z.number(),
      outcome: z.string(), // added | duplicate_skipped | failed
      id: z.number().optional(),
    }),
  ),
  added_count: z.number(),
  skipped_count: z.number(),
})
export type BulkOutcome = z.infer<typeof bulkOutcomeSchema>

export const hukmSchema = z.object({
  id: z.number(),
  name: z.string(),
  label: z.string().nullable().optional(),
  arabic_name: z.string().nullable().optional(),
})
