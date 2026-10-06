import { z } from 'zod'

/**
 * A row of GET /projects (verified live 6 Oct 2026). Used by Home now and by the Project index next.
 * `question` is the literal "Not written yet" when empty (request file C-9); treat that as unset.
 */
export const projectNextActionSchema = z.object({
  label: z.string(),
  /** A frontend path such as /projects/12/evidence?state=candidate. */
  target: z.string(),
})

export const projectListItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  question: z.string().nullable().optional(),
  scope: z.string().nullable().optional(),
  stage: z.string(),
  is_archived: z.boolean().optional(),
  is_deleted: z.boolean().optional(),
  /** owner | researcher | reviewer | viewer (or a legacy name; see domain/roles). */
  my_role: z.string().nullable().optional(),
  evidence_count: z.number().optional(),
  resource_count: z.number().optional(),
  finding_count: z.number().optional(),
  tags: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  last_activity_at: z.string().nullable().optional(),
  recovery_deadline: z.string().nullable().optional(),
  next_action: projectNextActionSchema.nullable().optional(),
  owner: z.object({ id: z.number().nullable(), display_name: z.string().nullable() }).nullable().optional(),
})
export type ProjectListItem = z.infer<typeof projectListItemSchema>

/** meta.counts on GET /projects: the tab counts of the project index. */
export const projectCountsSchema = z.object({
  owned: z.number(),
  shared: z.number(),
  archived: z.number().default(0),
  trash: z.number().default(0),
})
export type ProjectCounts = z.infer<typeof projectCountsSchema>

export type ProjectScope = 'owned' | 'shared' | 'archived' | 'trash'

/** The backend stores this text when a project has no question yet. */
export const UNWRITTEN_QUESTION = 'Not written yet'

export function hasQuestion(p: Pick<ProjectListItem, 'question'>): boolean {
  const q = p.question?.trim()
  return !!q && q !== UNWRITTEN_QUESTION
}
