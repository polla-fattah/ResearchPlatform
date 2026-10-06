import { z } from 'zod'

/** The kinds of discrepancy the server accepts. Names are shown through i18n; the Arabic terms are for specialist review. */
export const DISCREPANCIES = ['irsal_vs_ittisal', 'waqf_vs_raf', 'ziyadah_thiqah', 'tashif', 'qalb', 'ikhtilaf_sanad', 'shudhudh'] as const
export type Discrepancy = (typeof DISCREPANCIES)[number]

/** `under_investigation` is the only state a case starts in. The two "resolved" values are a researcher's preference, not a grade. */
export const CASE_STATUSES = ['under_investigation', 'resolved_authentic', 'resolved_defective', 'inconclusive'] as const
export type CaseStatus = (typeof CASE_STATUSES)[number]

const text = z.string().nullable().optional()

/**
 * The server stores `competing_variants` and `critics_judgments` as free-form lists with no schema (its own test writes
 * `{chain_id, narrator, state}` and `{critic, verdict}`). The screen writes the shapes below and reads anything else
 * leniently: unknown fields are kept (`passthrough`) so a write never drops what another client stored (request file C-36).
 */
export const variantSchema = z
  .object({ name: text, matn: text, chain: text, note: text, narrator: text, state: text, chain_id: z.number().nullable().optional() })
  .passthrough()
export type Variant = z.infer<typeof variantSchema>

export const criticSchema = z
  .object({ critic: text, verdict: text, source: text, favours: text, quote: text })
  .passthrough()
export type Critic = z.infer<typeof criticSchema>

export const ilalCaseSchema = z.object({
  id: z.number(),
  project_id: z.number().optional(),
  title: z.string(),
  discrepancy_category: z.string(),
  competing_variants: z.array(variantSchema).nullable().optional().transform((v) => v ?? []),
  critics_judgments: z.array(criticSchema).nullable().optional().transform((v) => v ?? []),
  preferred_version: text,
  status: z.string(),
  resolution_notes: text,
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  creator: z.object({ id: z.number().nullable().optional(), display_name: z.string().nullable().optional() }).nullable().optional(),
})
export type IlalCase = z.infer<typeof ilalCaseSchema>
