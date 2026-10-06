import { z } from 'zod'

/** The states a submission goes through, as the server names them. */
export const SUBMISSION_STATUSES = ['submitted', 'in_review', 'revision_requested', 'approved', 'rejected'] as const
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number]

/**
 * A submission as its AUTHORS may see it. The server also sends who reviewed it, what they wrote and what they scored,
 * and the editor's account; none of that is named here, so none of it can reach a screen (blind review, PUB-04, PUB-05;
 * request file C-29). Reviews are kept only as "how many are finished".
 */
export const submissionSchema = z.object({
  id: z.number(),
  project_id: z.number().optional(),
  parent_submission_id: z.number().nullable().optional(),
  version_number: z.number(),
  title: z.string(),
  abstract: z.string().nullable().optional(),
  keywords: z.array(z.string()).nullable().optional(),
  rights_declaration: z.string().nullable().optional(),
  coi_declared: z.boolean().nullable().optional(),
  author_response_notes: z.string().nullable().optional(),
  package_checksum: z.string().nullable().optional(),
  status: z.string(),
  submitted_at: z.string().nullable().optional(),
  reviews: z.array(z.object({ completed_at: z.string().nullable().optional() })).nullable().optional(),
  decision: z
    .object({
      decision: z.string().nullable().optional(),
      decision_notes: z.string().nullable().optional(),
      decided_at: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
})
export type Submission = z.infer<typeof submissionSchema>

/** What the server answers when a submission is created: only what is needed to confirm it. */
export const createdSubmissionSchema = submissionSchema.pick({ id: true, version_number: true, title: true, status: true, package_checksum: true, parent_submission_id: true })

export const ISSUE_SEVERITIES = ['error', 'warning'] as const
export const issueSchema = z.object({
  code: z.string(),
  severity: z.string().optional().default('error'),
  message: z.string().nullable().optional(),
  document_id: z.number().nullable().optional(),
  citation_id: z.number().nullable().optional(),
  user_id: z.number().nullable().optional(),
})
export type Issue = z.infer<typeof issueSchema>

export const validationSchema = z.object({
  is_valid: z.boolean(),
  issue_count: z.number().optional(),
  issues: z.array(issueSchema),
})
export type Validation = z.infer<typeof validationSchema>
