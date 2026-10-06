import { z } from 'zod'

/** One entry of a project's activity feed (`project_activities`). `summary` is the sentence the server wrote. */
export const activitySchema = z.object({
  id: z.number(),
  project_id: z.number().nullable().optional(),
  actor_id: z.number().nullable().optional(),
  action: z.string(),
  object_type: z.string().nullable().optional(),
  object_id: z.number().nullable().optional(),
  summary: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  actor: z.object({ id: z.number().nullable().optional(), display_name: z.string().nullable().optional() }).nullable().optional(),
})
export type Activity = z.infer<typeof activitySchema>
