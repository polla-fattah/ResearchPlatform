import {
  ASSESSMENT_CATEGORIES,
  UNCERTAINTY_LEVELS,
  type Alternative,
  type Assessment,
  type AssessmentCategory,
  type TrajectoryStop,
  type UncertaintyLevel,
} from '@/api/schemas/narratorDossier'

export const isUncertainty = (v: string | null | undefined): v is UncertaintyLevel => (UNCERTAINTY_LEVELS as readonly string[]).includes(v ?? '')
export const isAssessmentCategory = (v: string): v is AssessmentCategory => (ASSESSMENT_CATEGORIES as readonly string[]).includes(v)

/** An alternative is stored as text by some clients and as `{claim, source}` by this one. */
export const alternativeClaim = (a: Alternative): string => (typeof a === 'string' ? a : (a.claim ?? '')).trim()
export const alternativeSource = (a: Alternative): string => (typeof a === 'string' ? '' : (a.source ?? '')).trim()

/** Assessments grouped by the teacher they apply to, newest first inside each group; the groups keep first-seen order. */
export function groupByTeacher(items: readonly Assessment[]): { teacherId: number; items: Assessment[] }[] {
  const groups = new Map<number, Assessment[]>()
  for (const a of items) groups.set(a.teacher_id, [...(groups.get(a.teacher_id) ?? []), a])
  return [...groups].map(([teacherId, list]) => ({ teacherId, items: [...list].sort((x, y) => (y.created_at ?? '').localeCompare(x.created_at ?? '')) }))
}

/**
 * "AH 40–45", "AH 40", or null when the server has no year at all. A missing year is unknown, never 0, and an end before
 * the start is shown as recorded rather than corrected.
 */
export function yearsLabel(stop: Pick<TrajectoryStop, 'year_start' | 'year_end'>): string | null {
  const { year_start: from, year_end: to } = stop
  if (from == null && to == null) return null
  if (from != null && to != null && to !== from) return `${from}–${to}`
  return String(from ?? to)
}

/** Whether a place name is available in the reading language, else the other one, else nothing. */
export function placeName(stop: Pick<TrajectoryStop, 'place_name_ar' | 'place_name_en'>, language: string): string | null {
  const ar = (stop.place_name_ar ?? '').trim()
  const en = (stop.place_name_en ?? '').trim()
  const first = language === 'en' ? en : ar
  return first || ar || en || null
}

/** A narrator's id from the address; anything but a whole positive number is "no narrator". */
export function parseNarratorId(raw: string | undefined): number | null {
  return raw && /^\d+$/.test(raw) && Number(raw) > 0 ? Number(raw) : null
}
