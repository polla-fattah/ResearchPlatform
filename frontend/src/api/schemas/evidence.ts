import { z } from 'zod'
import { libraryResourceSchema } from './library'

/** Only the person's id and display name are shown. Anything else the API sends along is ignored. */
const personSchema = z.object({ id: z.number(), display_name: z.string() })

export const annotationSchema = z.object({
  id: z.number(),
  author_id: z.number().nullable().optional(),
  annotation_kind: z.string(),
  /** private | project_shared */
  visibility: z.string(),
  body: z.string(),
  span_start: z.number().nullable().optional(),
  span_end: z.number().nullable().optional(),
  /** Accepted by the API but not stored yet (request file C-16). */
  attributed_to: z.string().nullable().optional(),
  source_locator: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  author: personSchema.nullable().optional(),
})
export type Annotation = z.infer<typeof annotationSchema>

export const evidenceItemSchema = z.object({
  id: z.number(),
  project_id: z.number(),
  resource_id: z.number(),
  captured_text: z.string(),
  locator: z.string().nullable().optional(),
  source_version: z.string().nullable().optional(),
  content_hash: z.string().nullable().optional(),
  state: z.string(),
  exclusion_reason: z.string().nullable().optional(),
  collector_id: z.number().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  resource: libraryResourceSchema.omit({ collections: true }).nullable().optional(),
  collector: personSchema.nullable().optional(),
})
export type EvidenceItem = z.infer<typeof evidenceItemSchema>

export const evidenceDetailSchema = evidenceItemSchema.extend({
  annotations: z.array(annotationSchema).optional(),
})

export const historyEntrySchema = z.object({
  id: z.number().optional(),
  action: z.string().optional(),
  summary: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  actor: personSchema.nullable().optional(),
})
export type HistoryEntry = z.infer<typeof historyEntrySchema>

export const historySchema = z.object({
  evidence_id: z.number(),
  current_state: z.string(),
  created_at: z.string().nullable().optional(),
  collector: z.string().nullable().optional(),
  history: z.array(historyEntrySchema),
})

export const dependenciesSchema = z.object({
  findings: z.array(
    z.object({
      id: z.number(),
      claim: z.string(),
      status: z.string().nullable().optional(),
      pivot: z
        .object({
          relation_type: z.string().nullable().optional(),
          interpretation: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
    }),
  ),
  documents: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      version_number: z.number().nullable().optional(),
      citation_type: z.string().nullable().optional(),
    }),
  ),
  total_dependencies: z.number().optional(),
})
export type Dependencies = z.infer<typeof dependenciesSchema>

export const findingOptionSchema = z.object({
  id: z.number(),
  claim: z.string(),
  status: z.string().nullable().optional(),
})
export type FindingOption = z.infer<typeof findingOptionSchema>

/** What 409 HAS_DEPENDENCIES carries when removing evidence that is still in use. */
export const hasDependenciesSchema = z.object({
  findings_count: z.number().optional(),
  citations_count: z.number().optional(),
  dependent_findings: z.array(z.object({ id: z.number(), claim: z.string() })).optional(),
})

export const RELATIONS = ['supporting', 'opposing', 'contextual', 'unresolved'] as const
export type Relation = (typeof RELATIONS)[number]
