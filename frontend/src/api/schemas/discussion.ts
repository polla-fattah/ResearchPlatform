import { z } from 'zod'

const person = z.object({ id: z.number().nullable().optional(), display_name: z.string().nullable().optional() })

/** What a discussion can be about (the server's `target_type` list). */
export const TARGET_TYPES = ['project', 'evidence', 'analysis', 'finding', 'document', 'passage'] as const
export type TargetType = (typeof TARGET_TYPES)[number]

export const threadSchema = z.object({
  id: z.number(),
  project_id: z.number().optional(),
  thread_type: z.string().nullable().optional(),
  target_type: z.string().nullable().optional(),
  target_id: z.number().nullable().optional(),
  title: z.string(),
  context_quote: z.string().nullable().optional(),
  context_locator: z.string().nullable().optional(),
  is_resolved: z.boolean().optional().default(false),
  resolution_notes: z.string().nullable().optional(),
  alternative_interpretation: z.string().nullable().optional(),
  resolved_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  comments_count: z.number().optional(),
  resolver: person.nullable().optional(),
})
export type Thread = z.infer<typeof threadSchema>

export const commentSchema = z.object({
  id: z.number(),
  thread_id: z.number().optional(),
  author_id: z.number().nullable().optional(),
  content: z.string(),
  created_at: z.string().nullable().optional(),
  author: person.nullable().optional(),
})
export type Comment = z.infer<typeof commentSchema>

/** The statuses the server accepts on a task. `done` and `blocked` have their own endpoints (a reason, a finish time). */
export const TASK_STATUSES = ['open', 'in_progress', 'blocked', 'done'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const taskSchema = z.object({
  id: z.number(),
  project_id: z.number().optional(),
  title: z.string(),
  description: z.string().nullable().optional(),
  assignee_id: z.number().nullable().optional(),
  due_date: z.string().nullable().optional(),
  status: z.string(),
  blocking_reason: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  assignee: person.nullable().optional(),
})
export type Task = z.infer<typeof taskSchema>
