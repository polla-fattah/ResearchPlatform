import { z } from 'zod'

/**
 * A project template as the server keeps it: a title, a description, a starting question, a list of suggested stages and
 * a list of starting tasks. The server's own tasks are `{ title }`, anything else in an entry is ignored. There is no
 * version, no list of research questions, no evidence fields and no milestones with dates (request file C-41).
 */
export const templateTaskSchema = z.object({ title: z.string().nullable().optional() }).passthrough()

export const templateSchema = z.object({
  id: z.number(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  default_question: z.string().nullable().optional(),
  recommended_stages: z.array(z.unknown()).nullable().optional().transform((v) => v ?? []),
  default_tasks: z.array(templateTaskSchema).nullable().optional().transform((v) => v ?? []),
})
export type ProjectTemplate = z.infer<typeof templateSchema>
