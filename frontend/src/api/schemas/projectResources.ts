import { z } from 'zod'
import { jsonList, libraryResourceSchema } from './library'

/** A resource in a project's own bibliography. The tags and reason live on the pivot row. */
export const projectResourceSchema = libraryResourceSchema.omit({ collections: true }).extend({
  provenance: z.string().nullable().optional(),
  pivot: z
    .object({
      added_by: z.number().nullable().optional(),
      inclusion_rationale: z.string().nullable().optional(),
      tags: jsonList(z.string()).optional(),
      created_at: z.string().nullable().optional(),
    })
    .optional(),
})
export type ProjectResource = z.infer<typeof projectResourceSchema>

export const projectCollectionSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable().optional(),
  items_count: z.number().optional(),
})
export type ProjectCollection = z.infer<typeof projectCollectionSchema>
