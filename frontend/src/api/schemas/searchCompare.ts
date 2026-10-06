import { z } from 'zod'

const text = z.string().nullable().optional()

/**
 * `POST /search-runs/compare` with two run ids. The server compares the corpus ids in the two runs' hit lists and answers
 * three lists of ids (new, gone, in both). It has no notion of a record that "changed" (request file C-40).
 */
export const runComparisonSchema = z.object({
  run_1: z.object({ id: z.number().nullable().optional(), match_count: z.number().nullable().optional(), created_at: text }).nullable().optional(),
  run_2: z.object({ id: z.number().nullable().optional(), match_count: z.number().nullable().optional(), created_at: text }).nullable().optional(),
  diff: z.object({
    added_count: z.number(),
    removed_count: z.number(),
    retained_count: z.number(),
    added_ids: z.array(z.number()),
    removed_ids: z.array(z.number()),
    retained_ids: z.array(z.number()),
  }),
})
export type RunComparison = z.infer<typeof runComparisonSchema>

export const FREQUENCIES = ['daily', 'weekly', 'monthly'] as const
export type Frequency = (typeof FREQUENCIES)[number]

/**
 * One person's wish to be told about a saved query. The server embeds the whole user account; only the name is read.
 * Nothing on the server reruns the query or sends an alert yet (request file C-40).
 */
export const subscriptionSchema = z.object({
  id: z.number(),
  project_id: z.number().optional(),
  user_id: z.number(),
  saved_query_id: z.number(),
  frequency: z.string(),
  is_active: z.boolean(),
  last_run_at: text,
  last_result_count: z.number().nullable().optional(),
  saved_query: z.object({ id: z.number(), name: text }).passthrough().nullable().optional(),
  user: z.object({ id: z.number().nullable().optional(), display_name: text }).nullable().optional(),
})
export type Subscription = z.infer<typeof subscriptionSchema>
