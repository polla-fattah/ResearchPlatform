import { z } from 'zod'

const text = z.string().nullable().optional()

/**
 * `GET /corpus/books/{id}/structure`. Despite the name it is a flat list of chapters (no sections, no nesting), in id
 * order, each with the number of occurrences in it. `chapter_number` is the chapter's number or, when it has none, its
 * internal id, so it cannot be told apart from a printed number and is not read (request file C-38).
 */
export const chapterOutlineSchema = z.object({
  chapter_id: z.number(),
  chapter_title: text,
  occurrence_count: z.number(),
})
export type ChapterOutline = z.infer<typeof chapterOutlineSchema>

export const structureSchema = z.object({
  book_id: z.number(),
  book_title: z.string(),
  author: z.object({ name: text }).passthrough().nullable().optional(),
  total_chapters: z.number(),
  total_occurrences: z.number(),
  chapters: z.array(chapterOutlineSchema),
})
export type BookStructure = z.infer<typeof structureSchema>

export const concordanceSampleSchema = z.object({
  reference_id: z.number(),
  book_id: z.number().nullable().optional(),
  book_title: text,
  chapter_title: text,
  number: z.union([z.number(), z.string()]).nullable().optional(),
  snippet: z.string(),
})
export type ConcordanceSample = z.infer<typeof concordanceSampleSchema>

/**
 * `GET /corpus/concordance`. `total_matches` is the number of rows returned, which the `limit` caps; it is not a count of
 * the corpus. `book_distribution` counts those returned rows only. Both are labelled as such on the screen.
 */
export const concordanceSchema = z.object({
  search_term: z.string(),
  total_matches: z.number(),
  book_distribution: z.record(z.string(), z.number()).default({}),
  concordance_samples: z.array(concordanceSampleSchema).default([]),
})
export type Concordance = z.infer<typeof concordanceSchema>
