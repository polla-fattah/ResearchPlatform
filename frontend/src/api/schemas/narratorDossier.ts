import { z } from 'zod'

const text = z.string().nullable().optional()
const person = z.object({ id: z.number().nullable().optional(), display_name: z.string().nullable().optional() })

/** How sure the researcher is. The server's own list, in the order from most to least sure. */
export const UNCERTAINTY_LEVELS = ['certain', 'highly_probable', 'probable', 'contested', 'speculative'] as const
export type UncertaintyLevel = (typeof UNCERTAINTY_LEVELS)[number]

/**
 * A dated or factual claim about a narrator kept by the project ("died in 197 AH"). The server stores the claim as free
 * text: there is no date field, no source field and no way to say what value was chosen between alternatives (request
 * file C-37). `competing_alternatives` is an untyped list; the screen writes `{ claim, source }` and reads anything else
 * as plain text.
 */
export const alternativeSchema = z.union([z.string(), z.object({ claim: text, source: text }).passthrough()])
export type Alternative = z.infer<typeof alternativeSchema>

export const assertionSchema = z.object({
  id: z.number(),
  project_id: z.number().optional(),
  subject_type: z.string(),
  subject_id: z.number().nullable().optional(),
  subject_name: z.string(),
  assertion_claim: z.string(),
  uncertainty_level: z.string().nullable().optional(),
  competing_alternatives: z.array(alternativeSchema).nullable().optional().transform((v) => v ?? []),
  adjudication_notes: text,
  created_at: text,
  updated_at: text,
  creator: person.nullable().optional(),
})
export type Assertion = z.infer<typeof assertionSchema>

/** What a critic said about a narrator's reports from one particular teacher. The server's fixed list. */
export const ASSESSMENT_CATEGORIES = ['sound', 'weakened_specifically', 'mudallis_from_him', 'unsubstantiated'] as const
export type AssessmentCategory = (typeof ASSESSMENT_CATEGORIES)[number]

export const assessmentSchema = z.object({
  id: z.number(),
  project_id: z.number().optional(),
  narrator_id: z.number(),
  teacher_id: z.number(),
  assessment_category: z.string(),
  critic_name: text,
  qawl_text: z.string(),
  created_at: text,
  creator: person.nullable().optional(),
})
export type Assessment = z.infer<typeof assessmentSchema>

/** A stop in a narrator's life, from the shared (not project-owned) geographic table. Read only here. */
export const trajectoryStopSchema = z.object({
  place_name_ar: text,
  place_name_en: text,
  region: text,
  type: text,
  year_start: z.number().nullable().optional(),
  year_end: z.number().nullable().optional(),
  is_inferred: z.boolean().nullable().optional(),
  evidence: text,
})
export type TrajectoryStop = z.infer<typeof trajectoryStopSchema>

export const trajectorySchema = z.object({
  narrator_id: z.number(),
  name: text,
  total_trajectory_points: z.number().optional(),
  stops: z.array(trajectoryStopSchema).optional().default([]),
})
export type Trajectory = z.infer<typeof trajectorySchema>
