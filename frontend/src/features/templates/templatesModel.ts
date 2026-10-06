import type { ProjectTemplate } from '@/api/schemas/templates'

/** The titles of the tasks the server will create, in its order. An entry with no title is not a task and is not counted. */
export function taskTitles(t: Pick<ProjectTemplate, 'default_tasks'>): string[] {
  return t.default_tasks.map((x) => (x.title ?? '').trim()).filter(Boolean)
}

/** The suggested stages as text; anything that is not text is left out. */
export function stageNames(t: Pick<ProjectTemplate, 'recommended_stages'>): string[] {
  return t.recommended_stages.filter((s): s is string => typeof s === 'string' && s.trim() !== '').map((s) => s.trim())
}

/**
 * The server crashes when a starting task has no title (it reads `$taskData['title']`), so a template with such an entry
 * cannot be used; the screen shows it as unavailable rather than letting the person hit a server error (C-41).
 */
export const isUsable = (t: Pick<ProjectTemplate, 'default_tasks'>): boolean => t.default_tasks.every((x) => (x.title ?? '').trim() !== '')

/** A title is taken when one of the person's own projects already has it, ignoring case and spacing. */
export function titleTaken(title: string, existing: readonly { id: number; title: string }[]): { id: number } | null {
  const wanted = title.trim().toLowerCase()
  if (!wanted) return null
  return existing.find((p) => p.title.trim().toLowerCase() === wanted) ?? null
}
