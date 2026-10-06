import { z } from 'zod'
import { ApiError } from './errors'
import { api } from './http'
import { familyMemberSchema, familySchema, type Relationship } from './schemas/families'

const notKept = (what: string) =>
  new ApiError({ status: 200, code: 'NOT_PERSISTED', message: `The server did not keep the ${what}.`, details: { what } })

/** Every family of the project with its members (the server does not page them). */
export async function listFamilies(projectId: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/families`, { schema: z.array(familySchema), signal })
  return data
}

export interface NewFamily {
  canonical_title: string
  root_companion?: string
  core_theme?: string
}

export async function createFamily(projectId: number, input: NewFamily) {
  const { data } = await api(`/projects/${projectId}/families`, {
    method: 'POST',
    body: { canonical_title: input.canonical_title, root_companion: input.root_companion || undefined, core_theme: input.core_theme || undefined },
    schema: familySchema,
  })
  if (data.canonical_title !== input.canonical_title) throw notKept('title')
  return data
}

export interface NewMember {
  /** Exactly one of these says what the member is: a piece of evidence of this project, or a report of the corpus. */
  evidence_id?: number
  corpus_hadith_id?: number
  relationship_type: Relationship
  convergence_narrator?: string
  convergence_depth?: number
  scholarly_notes?: string
}

export async function addMember(projectId: number, familyId: number, input: NewMember) {
  const { data } = await api(`/projects/${projectId}/families/${familyId}/members`, { method: 'POST', body: input, schema: familyMemberSchema })
  if (data.relationship_type !== input.relationship_type) throw notKept('relationship')
  return data
}

export async function removeMember(projectId: number, familyId: number, memberId: number) {
  await api(`/projects/${projectId}/families/${familyId}/members/${memberId}`, { method: 'DELETE' })
}
