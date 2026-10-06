import { z } from 'zod'

/**
 * Corpus shapes as observed from the live backend on 5 Oct 2026.
 * "Occurrence" in the design = `reference` here. Many columns are null in real data, so
 * everything the corpus may leave empty is nullable. Unknown stays unknown: never default
 * a missing value to an empty string in the UI.
 */
const dateText = z.string().nullable().optional()

export const corpusAuthorSchema = z.object({
  id: z.number(),
  name: z.string(),
  kunya: z.string().nullable().optional(),
  nasab: z.string().nullable().optional(),
  shohra: z.string().nullable().optional(),
  deathdate: dateText,
})

export const corpusBookSchema = z.object({
  id: z.number(),
  title: z.string(),
  publisher: z.string().nullable().optional(),
  edition: z.string().nullable().optional(),
  number_of_parts: z.number().nullable().optional(),
  century: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  is_printed: z.string().nullable().optional(),
  author_id: z.number().nullable().optional(),
  author: corpusAuthorSchema.nullable().optional(),
  references_count: z.number().optional(),
})

export const corpusHukmSchema = z.object({
  id: z.number(),
  /** Transliterated code such as "Sa7ee7". */
  name: z.string(),
  /** Arabic label added by the backend on search results (6 Oct 2026), e.g. صحيح. */
  label: z.string().nullable().optional(),
})

export const corpusNarratorSchema = z.object({
  id: z.number(),
  name: z.string(),
  kunya: z.string().nullable().optional(),
  laqab: z.string().nullable().optional(),
  nasab: z.string().nullable().optional(),
  shohra: z.string().nullable().optional(),
  rutba: z.number().nullable().optional(),
  rutba_description: z.string().nullable().optional(),
  tabaqah: z.unknown().nullable().optional(),
  tadlis: z.boolean().nullable().optional(),
  has_ikhtilat: z.boolean().nullable().optional(),
  birthdate: dateText,
  deathdate: dateText,
  shyookh_count: z.number().optional(),
  students_count: z.number().optional(),
  transmissions_count: z.number().optional(),
  criticisms_count: z.number().optional(),
})

export const corpusSanadNodeSchema = z.object({
  id: z.number(),
  narrator_id: z.number().nullable().optional(),
  narrator: corpusNarratorSchema.nullable().optional(),
})

export const corpusSanadSchema = z.object({
  id: z.number(),
  reference_id: z.number(),
  depth: z.number().nullable().optional(),
  sharh: z.string().nullable().optional(),
  narrator_nodes: z.array(corpusSanadNodeSchema).optional(),
})

export const corpusReferenceSchema = z.object({
  id: z.number(),
  hadith_id: z.number(),
  book_id: z.number().nullable().optional(),
  chapter_id: z.number().nullable().optional(),
  section_id: z.number().nullable().optional(),
  hukm_id: z.number().nullable().optional(),
  hadith_number: z.number().nullable().optional(),
  page_number: z.number().nullable().optional(),
  book: corpusBookSchema.nullable().optional(),
  hukm: corpusHukmSchema.nullable().optional(),
  sanads: z.array(corpusSanadSchema).optional(),
})

/** A hadith is the "report record"; its `references` are the occurrences. */
export const corpusHadithSchema = z.object({
  id: z.number(),
  full_hadith: z.string().nullable().optional(),
  matn: z.string().nullable(),
  clean_matn: z.string().nullable(),
  type: z.string().nullable().optional(),
  references: z.array(corpusReferenceSchema).optional(),
})

export const corpusCriticismSchema = z.object({
  id: z.number(),
  qawl: z.string(),
  narrator_id: z.number(),
  scholar: corpusNarratorSchema.nullable().optional(),
})

export type CorpusBook = z.infer<typeof corpusBookSchema>
export type CorpusNarrator = z.infer<typeof corpusNarratorSchema>
export type CorpusReference = z.infer<typeof corpusReferenceSchema>
export type CorpusHadith = z.infer<typeof corpusHadithSchema>
export type CorpusCriticism = z.infer<typeof corpusCriticismSchema>

/**
 * Search result item (backend change 6 Oct 2026): `occurrences[]` replaced `references[]`.
 * Both are accepted until the backend confirms the contract (request file C-6).
 * `highlights` are character offsets into the ORIGINAL `matn`, never the normalised copy.
 */
export const corpusHighlightSchema = z.object({ start: z.number(), length: z.number() })

export const corpusOccurrenceSchema = z.object({
  /** Needs confirmation: should be the reference id (C-6). */
  id: z.number(),
  /** In search hits the book is slim; `author` was a string until 6 Oct and is now { id, name }. */
  book: z
    .object({
      id: z.number(),
      title: z.string(),
      edition: z.string().nullable().optional(),
      author: z
        .union([z.string(), z.object({ id: z.number(), name: z.string() })])
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
  /** Locator fields (added by the backend 6 Oct 2026; request file C-6). */
  hadith_number: z.number().nullable().optional(),
  page_number: z.number().nullable().optional(),
  volume: z.union([z.number(), z.string()]).nullable().optional(),
  edition: z.string().nullable().optional(),
  chapter: z.object({ id: z.number(), title: z.string().nullable().optional() }).nullable().optional(),
  hukm: corpusHukmSchema.nullable().optional(),
  chain_summary: z
    .object({
      narrator_count: z.number(),
      first_names: z.array(z.string()),
      order_uncertain: z.boolean(),
    })
    .nullable()
    .optional(),
})

export const corpusSearchHitSchema = corpusHadithSchema.extend({
  matched_mode: z.string().optional(),
  why: z.string().optional(),
  highlights: z.array(corpusHighlightSchema).optional(),
  occurrences_count: z.number().optional(),
  occurrences: z.array(corpusOccurrenceSchema).optional(),
})

export type CorpusSearchHit = z.infer<typeof corpusSearchHitSchema>
export type CorpusOccurrence = z.infer<typeof corpusOccurrenceSchema>
