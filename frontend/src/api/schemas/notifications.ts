import { z } from 'zod'

/** One notification. `type` is free text on the server; the screen knows four and shows any other as it is. */
export const notificationSchema = z.object({
  id: z.number(),
  type: z.string(),
  title: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
  target_type: z.string().nullable().optional(),
  target_id: z.number().nullable().optional(),
  is_read: z.boolean().optional().default(false),
  read_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
})
export type AppNotification = z.infer<typeof notificationSchema>

/** GET /notifications: the page of notifications and the unread count of the whole account. */
export const notificationPageSchema = z.object({
  unread_count: z.number(),
  notifications: z.array(notificationSchema),
})

/** The assigned tasks the screen reads to find which project a task notification is about. */
export const myTaskSchema = z.object({
  id: z.number(),
  project_id: z.number(),
  project: z.object({ id: z.number().optional(), title: z.string().nullable().optional() }).nullable().optional(),
})
