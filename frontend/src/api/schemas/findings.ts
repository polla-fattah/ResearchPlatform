import { z } from 'zod'
import { personSchema } from './documents'

export const FINDING_STATUSES = ['provisional', 'supported', 'inconclusive', 'disputed', 'withdrawn'] as const
export type FindingStatus = (typeof FINDING_STATUSES)[number]

export const findingEvidenceLinkSchema = z.object({
  id: z.number(),
  resource_id: z.number().optional(),
  captured_text: z.string().optional(),
  locator: z.string().nullable().optional(),
  state: z.string().optional(),
  pivot: z
    .object({
      relation_type: z.enum(['supporting', 'opposing', 'contextual', 'unresolved']),
      interpretation: z.string().nullable().optional(),
      created_at: z.string().nullable().optional(),
    })
    .optional(),
  resource: z
    .object({
      id: z.number(),
      title: z.string(),
      author: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  collector: personSchema.nullable().optional(),
})
export type FindingEvidenceLink = z.infer<typeof findingEvidenceLinkSchema>

export const findingSchema = z.object({
  id: z.number(),
  project_id: z.number(),
  question: z.string(),
  claim: z.string(),
  reasoning: z.string(),
  limitations: z.string().nullable().optional(),
  status: z.enum(FINDING_STATUSES),
  version: z.number().optional(),
  contributors: z.array(z.string()).nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  evidence_items: z.array(findingEvidenceLinkSchema).optional(),
  documents: z
    .array(
      z.object({
        id: z.number(),
        title: z.string(),
        document_type: z.string().optional(),
      }),
    )
    .optional(),
})
export type FindingItem = z.infer<typeof findingSchema>
