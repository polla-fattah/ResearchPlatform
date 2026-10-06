import { z } from 'zod'

/**
 * Findings and documents. The API embeds the whole user (e-mail, roles, profile) wherever a person appears
 * (request file C-18); only the id and display name are read here, so nothing else reaches the screen.
 */
const person = z.object({ id: z.number(), display_name: z.string() })

// ---- findings -------------------------------------------------------------------------------------------------

/** What the API accepts. The design also has "withdrawn", which the API rejects (request file C-18). */
export const FINDING_STATUSES = ['provisional', 'supported', 'inconclusive', 'disputed'] as const
export type FindingStatus = (typeof FINDING_STATUSES)[number]

export { RELATIONS, type Relation } from './evidence'

export const findingEvidenceSchema = z.object({
  id: z.number(),
  captured_text: z.string(),
  locator: z.string().nullable().optional(),
  state: z.string().optional(),
  pivot: z
    .object({
      relation_type: z.string().nullable().optional(),
      interpretation: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  resource: z.object({ id: z.number(), title: z.string(), author: z.string().nullable().optional() }).nullable().optional(),
})
export type FindingEvidence = z.infer<typeof findingEvidenceSchema>

export const findingSchema = z.object({
  id: z.number(),
  project_id: z.number(),
  question: z.string(),
  claim: z.string(),
  reasoning: z.string(),
  limitations: z.string().nullable().optional(),
  status: z.string(),
  version: z.number().nullable().optional(),
  contributors: z.array(z.string()).nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  evidence_items: z.array(findingEvidenceSchema).optional(),
  documents: z.array(z.object({ id: z.number(), title: z.string(), document_type: z.string().nullable().optional() })).optional(),
})
export type Finding = z.infer<typeof findingSchema>

// ---- documents ------------------------------------------------------------------------------------------------

export const DOCUMENT_TYPES = ['article', 'dossier', 'dataset_note'] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export const CITATION_MODES = ['direct_quotation', 'paraphrase', 'reference'] as const
export type CitationMode = (typeof CITATION_MODES)[number]

export const citationSchema = z.object({
  id: z.number().optional(),
  evidence_id: z.number().nullable().optional(),
  resource_id: z.number(),
  locator: z.string().nullable().optional(),
  citation_type: z.string().nullable().optional(),
  formatted_citation: z.string(),
  resource: z.object({ id: z.number(), title: z.string(), author: z.string().nullable().optional() }).nullable().optional(),
  evidence: z.object({ id: z.number(), captured_text: z.string(), locator: z.string().nullable().optional() }).nullable().optional(),
})
export type Citation = z.infer<typeof citationSchema>

export const versionSchema = z.object({
  id: z.number(),
  document_id: z.number(),
  version_number: z.number(),
  content: z.string(),
  change_summary: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  author: person.nullable().optional(),
  citations: z.array(citationSchema).optional(),
})
export type DocumentVersion = z.infer<typeof versionSchema>

export const documentSchema = z.object({
  id: z.number(),
  project_id: z.number(),
  title: z.string(),
  document_type: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  lock_version: z.number().nullable().optional(),
  locked_by: z.number().nullable().optional(),
  locked_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  latest_version: versionSchema.nullable().optional(),
  findings: z.array(z.object({ id: z.number(), claim: z.string(), status: z.string().nullable().optional() })).optional(),
})
export type DocumentItem = z.infer<typeof documentSchema>

export const draftSchema = z.object({
  draft_content: z.string().nullable().optional(),
  draft_base_version: z.number().nullable().optional(),
  last_saved_at: z.string().nullable().optional(),
  saved_by_id: z.number().nullable().optional(),
})
export type Draft = z.infer<typeof draftSchema>

export const draftSavedSchema = z.object({
  saved_by: z.string().nullable().optional(),
  draft_base_version: z.number().nullable().optional(),
})

export const citePreviewSchema = z.object({
  evidence_id: z.number(),
  resource_id: z.number().nullable().optional(),
  citation_type: z.string(),
  formatted_citation: z.string(),
  missing_components: z.array(z.string()),
  has_incomplete_citation: z.boolean(),
})
export type CitePreview = z.infer<typeof citePreviewSchema>

export const lockSchema = z.object({
  document_id: z.number(),
  locked_by: z.number(),
  locked_at: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
})
export type Lock = z.infer<typeof lockSchema>

/** What 409 CONFLICT carries when a version is saved on top of a newer one. */
export const conflictSchema = z.object({
  current_version: z.number(),
  current_content: z.string().nullable().optional(),
  current_author: z.string().nullable().optional(),
  saved_at: z.string().nullable().optional(),
})
export type SaveConflict = z.infer<typeof conflictSchema>
