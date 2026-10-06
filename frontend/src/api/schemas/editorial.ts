import { z } from 'zod'

const person = z.object({ id: z.number().nullable().optional(), display_name: z.string().nullable().optional() })

/** The reviewing stages the queue filters by (the server's `stage` names). */
export const QUEUE_STAGES = ['triage', 'under_review', 'revisions_pending', 'ready_for_decision', 'approved_pending_release'] as const
export type QueueStage = (typeof QUEUE_STAGES)[number]

export const DECISIONS = ['approve', 'request_revisions', 'reject'] as const
export type Decision = (typeof DECISIONS)[number]

/** One review as an EDITOR sees it: who, what they recommended and wrote. Only the editor routes may carry this. */
export const editorReviewSchema = z.object({
  id: z.number(),
  reviewer_id: z.number().nullable().optional(),
  recommendation: z.string().nullable().optional(),
  score: z.number().nullable().optional(),
  reviewer_notes: z.string().nullable().optional(),
  coi_confirmed: z.boolean().nullable().optional(),
  due_date: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  reviewer: person.nullable().optional(),
})
export type EditorReview = z.infer<typeof editorReviewSchema>

export const publicationRefSchema = z.object({
  id: z.number(),
  public_slug: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  version_string: z.string().nullable().optional(),
  doi: z.string().nullable().optional(),
  license: z.string().nullable().optional(),
  released_at: z.string().nullable().optional(),
  retraction_reason: z.string().nullable().optional(),
  corrigenda: z.array(z.object({ id: z.number().optional(), notice: z.string().optional(), new_version: z.string().optional(), previous_version: z.string().optional(), created_at: z.string().nullable().optional() })).nullable().optional(),
})
export type PublicationRef = z.infer<typeof publicationRefSchema>

/**
 * A submission in the editorial console, in the queue and on its own page. The server also sends the whole frozen package
 * with every row; it is not named here, so it is never kept.
 */
export const editorSubmissionSchema = z.object({
  id: z.number(),
  project_id: z.number().nullable().optional(),
  parent_submission_id: z.number().nullable().optional(),
  version_number: z.number(),
  title: z.string(),
  abstract: z.string().nullable().optional(),
  keywords: z.array(z.string()).nullable().optional(),
  rights_declaration: z.string().nullable().optional(),
  author_response_notes: z.string().nullable().optional(),
  package_checksum: z.string().nullable().optional(),
  status: z.string(),
  submitted_at: z.string().nullable().optional(),
  project: z.object({ id: z.number().nullable().optional(), title: z.string().nullable().optional(), owner: person.nullable().optional() }).nullable().optional(),
  submitter: person.nullable().optional(),
  reviews: z.array(editorReviewSchema).nullable().optional(),
  decision: z
    .object({
      id: z.number().optional(),
      decision: z.string().nullable().optional(),
      decision_notes: z.string().nullable().optional(),
      decided_at: z.string().nullable().optional(),
      editor: person.nullable().optional(),
    })
    .nullable()
    .optional(),
  publication: publicationRefSchema.nullable().optional(),
})
export type EditorSubmission = z.infer<typeof editorSubmissionSchema>

export const candidateSchema = z.object({
  id: z.number(),
  display_name: z.string().nullable().optional(),
  affiliation: z.string().nullable().optional(),
  prior_reviews_count: z.number().optional(),
  coi: z.object({ blocked: z.boolean(), reason: z.string().nullable().optional() }).nullable().optional(),
})
export type Candidate = z.infer<typeof candidateSchema>

/** What the server answers to a decision. */
export const decisionResultSchema = z.object({
  decision: z.object({ decision: z.string().nullable().optional() }).passthrough().nullable().optional(),
  submission_status: z.string(),
})
