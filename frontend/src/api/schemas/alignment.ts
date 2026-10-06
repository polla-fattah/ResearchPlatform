import { z } from 'zod'
import { analysisRunSchema } from './analyses'

/** What one aligned slot is: the same word, a different word, a word only in the variant, a word only in the baseline. */
export const OPERATIONS = ['match', 'substitution', 'insertion', 'deletion'] as const
export type Operation = (typeof OPERATIONS)[number]

export const operationSchema = z.object({
  op: z.string(),
  token_a: z.string().nullable().optional(),
  token_b: z.string().nullable().optional(),
  pos_a: z.number().nullable().optional(),
  pos_b: z.number().nullable().optional(),
})
export type AlignedSlot = z.infer<typeof operationSchema>

export const alignmentSchema = z.object({
  alignment_score: z.number().optional(),
  similarity_percentage: z.number().optional(),
  summary: z
    .object({
      total_aligned_slots: z.number().optional(),
      matches: z.number().optional(),
      substitutions: z.number().optional(),
      additions_ziyadah: z.number().optional(),
      omissions_saqt: z.number().optional(),
    })
    .optional(),
  operations: z.array(operationSchema),
})
export type Alignment = z.infer<typeof alignmentSchema>

export const comparisonSchema = z.object({
  variant_id: z.union([z.string(), z.number()]),
  label: z.string().optional(),
  raw_text: z.string().optional(),
  collation: alignmentSchema,
})
export type VariantAlignment = z.infer<typeof comparisonSchema>

/** The service's `collateVariants` answer: the baseline and one alignment of it against each variant. */
export const collationSchema = z.object({
  baseline_text: z.string().optional(),
  baseline_token_count: z.number().optional(),
  variant_count: z.number().optional(),
  comparisons: z.array(comparisonSchema),
})
export type Collation = z.infer<typeof collationSchema>

export const collateAnswerSchema = z.object({ collation: collationSchema, saved_run: analysisRunSchema.nullable().optional() })
