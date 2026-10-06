import { z } from 'zod'

/**
 * A public announcement as the server's whitelist sends it. The schema names only what the public pages show, and zod
 * drops every other key, so a field the server should not have sent can never reach a page (request file C-26, DEF-5).
 */
export const publicAnnouncementSchema = z.object({
  public_slug: z.string(),
  title: z.string(),
  summary: z.string(),
  research_stage: z.string().nullable().optional(),
  keywords: z.array(z.string()).nullable().optional(),
  published_at: z.string().nullable().optional(),
  project: z
    .object({
      title: z.string().nullable().optional(),
      scope: z.string().nullable().optional(),
      stage: z.string().nullable().optional(),
      owner: z
        .object({
          display_name: z.string().nullable().optional(),
          affiliation: z.string().nullable().optional(),
          biography: z.string().nullable().optional(),
          research_interests: z.array(z.string()).nullable().optional(),
        })
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
})
export type PublicAnnouncement = z.infer<typeof publicAnnouncementSchema>
