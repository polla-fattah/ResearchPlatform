import { z } from 'zod'

export const personSchema = z.object({
  id: z.number(),
  display_name: z.string(),
})

export const citationItemSchema = z.object({
  id: z.number().optional(),
  document_version_id: z.number().optional(),
  resource_id: z.number(),
  evidence_id: z.number().nullable().optional(),
  locator: z.string().nullable().optional(),
  citation_type: z.enum(['direct_quotation', 'paraphrase', 'reference']).optional(),
  formatted_citation: z.string(),
  created_at: z.string().nullable().optional(),
  resource: z
    .object({
      id: z.number(),
      title: z.string(),
      author: z.string().nullable().optional(),
      metadata: z.record(z.string(), z.unknown()).nullable().optional(),
    })
    .nullable()
    .optional(),
})
export type CitationItem = z.infer<typeof citationItemSchema>

export const documentVersionSchema = z.object({
  id: z.number(),
  document_id: z.number(),
  version_number: z.number(),
  content: z.string(),
  author_id: z.number().nullable().optional(),
  change_summary: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  author: personSchema.nullable().optional(),
  citations: z.array(citationItemSchema).optional(),
})
export type DocumentVersion = z.infer<typeof documentVersionSchema>

export const documentFindingLinkSchema = z.object({
  id: z.number(),
  question: z.string().optional(),
  claim: z.string(),
  status: z.string().nullable().optional(),
})

export const documentSchema = z.object({
  id: z.number(),
  project_id: z.number(),
  title: z.string(),
  document_type: z.string().optional(),
  language: z.string().optional(),
  lock_version: z.number().optional(),
  draft_content: z.string().nullable().optional(),
  draft_base_version: z.number().nullable().optional(),
  draft_saved_at: z.string().nullable().optional(),
  draft_author_id: z.number().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  latest_version: documentVersionSchema.nullable().optional(),
  findings: z.array(documentFindingLinkSchema).optional(),
})
export type DocumentItem = z.infer<typeof documentSchema>

export const draftResponseSchema = z.object({
  draft_content: z.string().nullable().optional(),
  draft_base_version: z.number().nullable().optional(),
  last_saved_at: z.string().nullable().optional(),
  saved_by_id: z.number().nullable().optional(),
})
export type DraftResponse = z.infer<typeof draftResponseSchema>

export const citePreviewSchema = z.object({
  evidence_id: z.number(),
  resource_id: z.number().nullable().optional(),
  citation_type: z.string(),
  formatted_citation: z.string(),
  missing_components: z.array(z.string()),
  has_incomplete_citation: z.boolean(),
})
export type CitePreview = z.infer<typeof citePreviewSchema>
