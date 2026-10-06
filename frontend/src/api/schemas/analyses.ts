import { z } from 'zod'

/**
 * Shapes of the analysis endpoints as observed on the live backend on 6 Oct 2026 (request file C-19).
 *
 * PHP serialises an empty array as `[]` where a map is meant, so every map goes through `phpMap`.
 * Only a person's id and display name are read from `creator`; the API sends the whole account.
 */
const phpMap = <T extends z.ZodType>(value: T) =>
  z.preprocess((v) => (Array.isArray(v) && v.length === 0 ? {} : v), z.record(z.string(), value))

const id = z.union([z.number(), z.string()])

/** The kinds of run the three R1a comparisons store. The others (collation, topology, temporal) belong to R2a. */
export const RUN_TYPES = ['matn_comparison', 'isnad_comparison', 'criticism_matrix', 'narrator_dossier', 'ilal_case'] as const
export type RunType = (typeof RUN_TYPES)[number]

export const analysisRunSchema = z.object({
  id: z.number(),
  project_id: z.number(),
  /** Not narrowed: the server also stores `sequence_collation`, `isnad_topology` and `temporal_csp` runs. */
  analysis_type: z.string(),
  input_params: phpMap(z.unknown()),
  /**
   * Runs made by the service have the shapes below. Runs written some other way (the demo data, or POST /analyses/save)
   * can have any shape, so this stays open and is checked with the `parse…` helpers before it is drawn as a table.
   */
  output_data: phpMap(z.unknown()),
  version_number: z.number(),
  created_by: z.number().nullable().optional(),
  created_at: z.string().nullable().optional(),
  creator: z.object({ id: z.number(), display_name: z.string() }).nullable().optional(),
})
export type AnalysisRun = z.infer<typeof analysisRunSchema>

// ── matn comparison ───────────────────────────────────────────────────────────────────────────────────────────
export const matnVariantSchema = z.object({
  id,
  label: z.string().optional(),
  raw_text: z.string(),
  normalized_text: z.string(),
  token_count: z.number(),
  tokens: z.array(z.string()),
})

export const matnCompareResultSchema = z.object({
  analysis_type: z.literal('matn_comparison'),
  baseline_id: id.nullable().optional(),
  variant_count: z.number(),
  variants: z.array(matnVariantSchema),
  consensus_core_tokens: z.array(z.string()),
  consensus_core_count: z.number(),
  unique_words_summary: phpMap(z.object({ unique_tokens: z.array(z.string()), unique_count: z.number() })),
  similarity_matrix: phpMap(phpMap(z.number())),
  diff_against_baseline: phpMap(
    z.object({ target_id: id, additions: z.array(z.string()), deletions: z.array(z.string()), overlap_count: z.number() }),
  ).optional(),
})
export type MatnCompareResult = z.infer<typeof matnCompareResultSchema>
export type MatnVariant = z.infer<typeof matnVariantSchema>

// ── isnad comparison ──────────────────────────────────────────────────────────────────────────────────────────
const narratorRef = z.object({
  id: z.number(),
  name: z.string(),
  tabaqah: z.unknown().optional(),
  rutba: z.number().nullable().optional(),
  frequency: z.number(),
})

export const isnadCompareResultSchema = z.object({
  analysis_type: z.literal('isnad_comparison'),
  chain_count: z.number(),
  chains: z.array(
    z.object({
      sanad_id: z.number(),
      length: z.number(),
      /** `order` 1 is the narrator closest to the compiler; the last is the earliest source. */
      narrators: z.array(
        z.object({
          order: z.number(),
          narrator_id: z.number(),
          name: z.string(),
          tabaqah: z.unknown().optional(),
          rutba: z.number().nullable().optional(),
          connector: z.string().nullable().optional(),
        }),
      ),
    }),
  ),
  /** Narrators who are in every chain. This is not the same as a common link (a point where chains converge). */
  common_links: z.array(narratorRef),
  partial_common_links: z.array(narratorRef),
  divergence_order: z.number().nullable().optional(),
  summary: z.object({
    has_universal_common_link: z.boolean(),
    common_link_count: z.number(),
    pivotal_narrator: z.string().nullable().optional(),
  }),
})
export type IsnadCompareResult = z.infer<typeof isnadCompareResultSchema>
export type IsnadChain = IsnadCompareResult['chains'][number]

// ── criticism matrix ──────────────────────────────────────────────────────────────────────────────────────────
export const criticismMatrixResultSchema = z.object({
  analysis_type: z.literal('criticism_matrix'),
  narrator_count: z.number(),
  scholars: z.array(z.object({ id: z.number(), name: z.string() })),
  matrix: phpMap(
    z.object({
      narrator: z.object({ id: z.number(), name: z.string(), rutba: z.number().nullable().optional(), tabaqah: z.unknown().optional() }),
      evaluations: phpMap(
        z.object({
          scholar_id: z.number(),
          scholar_name: z.string(),
          /** "Unspecified" for every statement today (C-19): the label comes from a table the corpus does not fill. */
          hukm: z.string(),
          source_book: z.string().nullable().optional(),
          /** Always null today (C-19): the service reads a column that does not exist. */
          quote: z.string().nullable().optional(),
        }),
      ),
      counts: z.object({ total_statements: z.number(), taadil: z.number(), jarh: z.number() }),
    }),
  ),
  summary: z.array(
    z.object({
      narrator_id: z.number(),
      name: z.string(),
      total_evaluations: z.number(),
      taadil_ratio: z.number().nullable().optional(),
    }),
  ),
})
export type CriticismMatrixResult = z.infer<typeof criticismMatrixResultSchema>

/** A run's stored result as one of the three shapes the service makes, or null when it has some other shape. */
export function parseStored<T extends z.ZodType>(schema: T, output: unknown): z.infer<T> | null {
  const parsed = schema.safeParse(output)
  return parsed.success ? parsed.data : null
}
