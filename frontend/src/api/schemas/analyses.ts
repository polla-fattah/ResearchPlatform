import { z } from 'zod'

export const analysisRunSchema = z.object({
  id: z.number(),
  project_id: z.number(),
  analysis_type: z.string(),
  input_params: z.record(z.string(), z.unknown()),
  output_data: z.record(z.string(), z.unknown()),
  version_number: z.number(),
  created_by: z.number().nullable().optional(),
  created_at: z.string().nullable().optional(),
  creator: z
    .object({
      id: z.number(),
      display_name: z.string(),
    })
    .nullable()
    .optional(),
})

export type AnalysisRun = z.infer<typeof analysisRunSchema>

export const matnVariantSchema = z.object({
  id: z.union([z.number(), z.string()]),
  label: z.string().optional(),
  raw_text: z.string(),
  normalized_text: z.string(),
  token_count: z.number(),
  tokens: z.array(z.string()),
})

export const matnCompareResultSchema = z.object({
  analysis_type: z.literal('matn_comparison'),
  baseline_id: z.union([z.number(), z.string()]).nullable().optional(),
  variant_count: z.number(),
  variants: z.array(matnVariantSchema),
  consensus_core_tokens: z.array(z.string()),
  consensus_core_count: z.number(),
  unique_words_summary: z.record(
    z.string(),
    z.object({
      unique_tokens: z.array(z.string()),
      unique_count: z.number(),
    }),
  ),
  similarity_matrix: z.record(z.string(), z.record(z.string(), z.number())),
  diff_against_baseline: z
    .record(
      z.string(),
      z.object({
        target_id: z.union([z.number(), z.string()]),
        additions: z.array(z.string()),
        deletions: z.array(z.string()),
        overlap_count: z.number(),
      }),
    )
    .optional(),
})

export type MatnCompareResult = z.infer<typeof matnCompareResultSchema>

export const isnadNarratorNodeSchema = z.object({
  order: z.number(),
  narrator_id: z.number(),
  name: z.string(),
  tabaqah: z.unknown().optional(),
  rutba: z.unknown().optional(),
  connector: z.string().nullable().optional(),
})

export const isnadChainSchema = z.object({
  sanad_id: z.number(),
  length: z.number(),
  narrators: z.array(isnadNarratorNodeSchema),
})

export const isnadCommonLinkSchema = z.object({
  id: z.number(),
  name: z.string(),
  frequency: z.number(),
  tabaqah: z.unknown().optional(),
  rutba: z.unknown().optional(),
})

export const isnadCompareResultSchema = z.object({
  analysis_type: z.literal('isnad_comparison'),
  chain_count: z.number(),
  chains: z.array(isnadChainSchema),
  common_links: z.array(isnadCommonLinkSchema),
  partial_common_links: z.array(isnadCommonLinkSchema),
  divergence_order: z.number().nullable().optional(),
  summary: z.object({
    has_universal_common_link: z.boolean(),
    common_link_count: z.number(),
    pivotal_narrator: z.string().nullable().optional(),
  }),
})

export type IsnadCompareResult = z.infer<typeof isnadCompareResultSchema>

export const criticismEvaluationSchema = z.object({
  scholar_id: z.number(),
  scholar_name: z.string(),
  hukm: z.string(),
  source_book: z.string().nullable().optional(),
  quote: z.string().nullable().optional(),
})

export const criticismMatrixResultSchema = z.object({
  analysis_type: z.literal('criticism_matrix'),
  narrator_count: z.number(),
  critics: z.array(z.object({ id: z.number(), name: z.string() })),
  matrix: z.record(z.string(), z.record(z.string(), criticismEvaluationSchema)),
  narrators: z.record(
    z.string(),
    z.object({
      id: z.number(),
      name: z.string(),
      evaluations_count: z.number(),
      taadil_count: z.number(),
      jarh_count: z.number(),
      consensus_status: z.string(),
    }),
  ),
})

export type CriticismMatrixResult = z.infer<typeof criticismMatrixResultSchema>
