import { z } from 'zod'
import { activitySchema } from './activity'

/** The states the server stores. `hidden` is a moderator's doing; the owner can neither set nor lift it here. */
export const ANNOUNCEMENT_STATUSES = ['draft', 'published', 'unpublished', 'hidden'] as const
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number]

export const announcementSchema = z.object({
  id: z.number(),
  project_id: z.number().optional(),
  public_slug: z.string(),
  title: z.string(),
  summary: z.string(),
  research_stage: z.string(),
  keywords: z.array(z.string()).nullable().optional(),
  status: z.string(),
  published_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})
export type Announcement = z.infer<typeof announcementSchema>

/** GET /projects/{id}/announcement answers `null` data when the project has none. */
export const announcementOrNullSchema = announcementSchema.nullable()

export const announcementHistorySchema = z.object({
  announcement: announcementSchema,
  history: z.array(activitySchema),
})
