/** Fixed vocabularies shared by several screens. Labels live in i18n under the same keys. */

export const PROJECT_STAGES = [
  'scoping',
  'collecting',
  'analysing',
  'writing',
  'reviewing',
  'completed',
] as const
export type ProjectStage = (typeof PROJECT_STAGES)[number]

export const EVIDENCE_STATES = [
  'candidate',
  'included',
  'reviewed',
  'excluded',
  'unresolved',
] as const
export type EvidenceState = (typeof EVIDENCE_STATES)[number]

/** Unresolved and candidate are neutral (dashed), never red. "Reviewed" does not imply "authentic". */
export const NEUTRAL_EVIDENCE_STATES: readonly EvidenceState[] = ['unresolved']

export const ANNOTATION_KINDS = [
  'source_quotation',
  'interpretation',
  'scholarly_judgment',
  'machine_suggestion',
] as const
export type AnnotationKind = (typeof ANNOTATION_KINDS)[number]

export const VISIBILITIES = ['private', 'project', 'announcement', 'publication'] as const
export type Visibility = (typeof VISIBILITIES)[number]

export function isProjectStage(v: string): v is ProjectStage {
  return (PROJECT_STAGES as readonly string[]).includes(v)
}
