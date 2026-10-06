import { z } from 'zod'

export const RECOMMENDATIONS = ['approve', 'request_revisions', 'reject'] as const
export type Recommendation = (typeof RECOMMENDATIONS)[number]

/**
 * What a REVIEWER may read of the package. The server's frozen package also names the project, the submitter and the
 * collectors of the evidence (a project's title and scope can identify its authors); none of those is named here, so none can reach the screen (see `domain/blinding.ts`,
 * request file C-31). Documents and findings are kept for reading; the rest of an evidence item is not kept.
 */
export const reviewPackageSchema = z.object({
  abstract: z.string().nullable().optional(),
  exported_at: z.string().nullable().optional(),
  documents: z
    .array(
      z.object({
        id: z.number(),
        title: z.string(),
        document_type: z.string().nullable().optional(),
        language: z.string().nullable().optional(),
        latest_version: z
          .object({
            version_number: z.number().nullable().optional(),
            content: z.string().nullable().optional(),
            citations: z.array(z.object({ id: z.number().optional() })).nullable().optional(),
          })
          .nullable()
          .optional(),
      }),
    )
    .nullable()
    .optional(),
  findings: z
    .array(
      z.object({
        id: z.number(),
        question: z.string().nullable().optional(),
        claim: z.string(),
        reasoning: z.string().nullable().optional(),
        limitations: z.string().nullable().optional(),
        status: z.string().nullable().optional(),
        evidence_items: z.array(z.object({ id: z.number() })).nullable().optional(),
      }),
    )
    .nullable()
    .optional(),
})
export type ReviewPackage = z.infer<typeof reviewPackageSchema>

const submissionForReviewer = z.object({
  id: z.number(),
  title: z.string(),
  abstract: z.string().nullable().optional(),
  version_number: z.number().nullable().optional(),
  status: z.string().nullable().optional(),
  rights_declaration: z.string().nullable().optional(),
  keywords: z.array(z.string()).nullable().optional(),
  package_checksum: z.string().nullable().optional(),
  submitted_at: z.string().nullable().optional(),
  frozen_package: reviewPackageSchema.nullable().optional(),
})

/** One assignment as its reviewer sees it. */
export const assignmentSchema = z.object({
  id: z.number(),
  recommendation: z.string().nullable().optional(),
  score: z.number().nullable().optional(),
  reviewer_notes: z.string().nullable().optional(),
  coi_confirmed: z.boolean().nullable().optional(),
  due_date: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  submission: submissionForReviewer.nullable().optional(),
})
export type Assignment = z.infer<typeof assignmentSchema>
