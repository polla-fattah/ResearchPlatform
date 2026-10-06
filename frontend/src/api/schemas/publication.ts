import { z } from 'zod'
import { reviewPackageSchema } from './review'

/**
 * A publication as the PUBLIC may see it. The server's public answer also carries internal ids, the releaser, and each
 * review with an alias, a recommendation and (when it has them) the reviewer's comments; the schema keeps only how many
 * reviews were finished and drops the rest. Anything else the server adds never reaches a page (request file C-32).
 */
export const publicPublicationSchema = z.object({
  public_slug: z.string(),
  doi: z.string().nullable().optional(),
  title: z.string(),
  abstract: z.string().nullable().optional(),
  version_string: z.string().nullable().optional(),
  license: z.string().nullable().optional(),
  status: z.string(),
  retraction_reason: z.string().nullable().optional(),
  retracted_at: z.string().nullable().optional(),
  released_at: z.string().nullable().optional(),
  corrigenda: z
    .array(
      z.object({
        id: z.number().optional(),
        notice: z.string().nullable().optional(),
        new_version: z.string().nullable().optional(),
        previous_version: z.string().nullable().optional(),
        created_at: z.string().nullable().optional(),
      }),
    )
    .nullable()
    .optional(),
  project: z
    .object({
      title: z.string().nullable().optional(),
      scope: z.string().nullable().optional(),
      stage: z.string().nullable().optional(),
      owner: z.object({ display_name: z.string().nullable().optional(), affiliation: z.string().nullable().optional() }).nullable().optional(),
    })
    .nullable()
    .optional(),
  submission: z
    .object({
      version_number: z.number().nullable().optional(),
      reviews: z.array(z.object({ submitted_at: z.string().nullable().optional(), recommendation: z.string().nullable().optional() })).nullable().optional(),
    })
    .nullable()
    .optional(),
  published_content: reviewPackageSchema.nullable().optional(),
})
export type PublicPublication = z.infer<typeof publicPublicationSchema>

export const CITATION_FORMATS = ['bibtex', 'ris', 'apa'] as const
export type CitationFormat = (typeof CITATION_FORMATS)[number]

export const citationSchema = z.object({
  format: z.string(),
  citation: z.string(),
  doi: z.string().nullable().optional(),
})
