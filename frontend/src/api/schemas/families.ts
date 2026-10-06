import { z } from 'zod'

/**
 * How a member relates to the family's anchor report. The server accepts these four; `candidate` means "suggested or
 * proposed, not yet classified by a researcher". The platform's design wants project-defined types with definitions;
 * the server has this fixed list (request file C-35).
 */
export const RELATIONSHIPS = ['mutabaah_tammah', 'mutabaah_qasirah', 'shahid', 'candidate'] as const
export type Relationship = (typeof RELATIONSHIPS)[number]

const person = z.object({ id: z.number().nullable().optional(), display_name: z.string().nullable().optional() })

export const familyMemberSchema = z.object({
  id: z.number(),
  family_id: z.number().optional(),
  evidence_id: z.number().nullable().optional(),
  corpus_hadith_id: z.number().nullable().optional(),
  corpus_sanad_id: z.number().nullable().optional(),
  relationship_type: z.string(),
  convergence_narrator: z.string().nullable().optional(),
  convergence_depth: z.number().nullable().optional(),
  scholarly_notes: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  /** Kept to show what the member is: the captured wording and where it is from. The rest of the item is not read. */
  evidence: z
    .object({
      id: z.number(),
      captured_text: z.string().nullable().optional(),
      state: z.string().nullable().optional(),
      locator: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
})
export type FamilyMember = z.infer<typeof familyMemberSchema>

/** One family. The server also embeds the creator's whole account; only the name is read. */
export const familySchema = z.object({
  id: z.number(),
  project_id: z.number().optional(),
  canonical_title: z.string(),
  root_companion: z.string().nullable().optional(),
  core_theme: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  creator: person.nullable().optional(),
  members: z.array(familyMemberSchema).optional().default([]),
})
export type Family = z.infer<typeof familySchema>
