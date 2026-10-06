import { z } from 'zod'

/** GET /projects/{id}. Trashed projects answer 404 today (request file C-12), so they never reach this. */
export const projectDetailSchema = z.object({
  id: z.number(),
  owner_id: z.number(),
  title: z.string(),
  question: z.string().nullable().optional(),
  scope: z.string().nullable().optional(),
  primary_language: z.string().nullable().optional(),
  languages: z.array(z.string()).nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  stage: z.string(),
  is_archived: z.boolean(),
  is_deleted: z.boolean(),
  archived_at: z.string().nullable().optional(),
  deleted_at: z.string().nullable().optional(),
  recovery_deadline: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  owner: z.object({ id: z.number(), display_name: z.string().nullable() }).nullable().optional(),
  memberships: z
    .array(
      z.object({
        user_id: z.number(),
        role: z.string(),
        status: z.string(),
        user: z.object({ id: z.number(), display_name: z.string().nullable() }).nullable().optional(),
      }),
    )
    .optional(),
})
export type ProjectDetail = z.infer<typeof projectDetailSchema>

export const evidenceCountsSchema = z.object({
  candidate: z.number(),
  included: z.number(),
  reviewed: z.number(),
  excluded: z.number(),
  unresolved: z.number(),
  total: z.number(),
})

/** GET /projects/{id}/summary (returns HTTP 500 today, request file C-5). */
export const projectSummarySchema = z.object({
  project_id: z.number(),
  stage: z.string(),
  evidence_counts: evidenceCountsSchema,
  resources_count: z.number(),
  saved_searches_count: z.number(),
  result_sets_count: z.number(),
  analyses_count: z.number(),
  findings_count: z.number(),
  documents_count: z.number(),
  open_tasks_count: z.number().optional(),
  last_activity_at: z.string().nullable().optional(),
})
export type ProjectSummary = z.infer<typeof projectSummarySchema>

export const milestoneSchema = z.object({
  id: z.number(),
  title: z.string(),
  due_date: z.string().nullable().optional(),
  progress_mode: z.string().nullable().optional(), // computed | manual
  manual_percent: z.number().nullable().optional(),
  computed_basis: z.string().nullable().optional(),
  status: z.string().nullable().optional(), // pending | in_progress | completed
})
export type Milestone = z.infer<typeof milestoneSchema>

export const projectQuestionSchema = z.object({
  id: z.number(),
  text: z.string(),
  linked_evidence_ids: z.array(z.number()).nullable().optional(),
  resolved: z.boolean().optional(),
  created_at: z.string().nullable().optional(),
})
export type ProjectQuestion = z.infer<typeof projectQuestionSchema>

export const copyResultSchema = z.array(
  z.object({ type: z.string(), id: z.number(), status: z.string() }),
)

export const copyPreviewSchema = z.array(
  z.object({ type: z.string(), id: z.number(), can_copy: z.boolean(), note: z.string().optional() }),
)

export interface CreateProjectInput {
  title: string
  question: string
  scope: string
  languages: string[]
  stage: string
  tags: string[]
}

export interface CopyItem {
  type: 'resource' | 'saved_query' | 'analysis'
  id: number
}

export interface MilestoneInput {
  title: string
  due_date?: string | null
  progress_mode?: 'computed' | 'manual'
  manual_percent?: number
}
