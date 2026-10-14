import { z } from 'zod'

const text = z.string().nullable().optional()

/**
 * `GET /corpus/books/{id}/structure`. Despite the name it is a flat list of chapters (no sections, no nesting), in id
 * order of the printed sequence (`sort_order`), each with the number of occurrences in it. `chapter_number` is that position
 * in the book, no longer the internal id (request file C-38, fixed on the server 7 Oct 2026).
 */
export const chapterOutlineSchema = z.object({
  chapter_id: z.number(),
  chapter_title: text,
  chapter_number: z.number().nullable().optional(),
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
 * `GET /corpus/concordance`. `total_matches` is the number of rows returned, which the `limit` caps. `total_available` is
 * the number of places in all, capped at 10 000 (`total_available_is_capped`). `incomplete` means the server stopped the
 * search after a few seconds, so the result may be missing places. `book_distribution` counts the returned rows only.
 */
export const concordanceSchema = z.object({
  search_term: z.string(),
  total_matches: z.number(),
  total_available: z.number().nullable().optional(),
  total_available_is_capped: z.boolean().nullable().optional(),
  incomplete: z.boolean().nullable().optional(),
  book_distribution: z.record(z.string(), z.number()).default({}),
  concordance_samples: z.array(concordanceSampleSchema).default([]),
})
export type Concordance = z.infer<typeof concordanceSchema>
