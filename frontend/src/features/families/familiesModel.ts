import type { Family, FamilyMember, Relationship } from '@/api/schemas/families'
import { RELATIONSHIPS } from '@/api/schemas/families'
import { reportCode } from '@/features/comparison/comparisonModel'
import { evidenceCode } from '@/features/evidence/evidenceModel'

export const isRelationship = (v: string): v is Relationship => (RELATIONSHIPS as readonly string[]).includes(v)

/** Members a researcher has classified, and the ones still waiting to be (type `candidate`). */
export function splitMembers(members: readonly FamilyMember[]): { reviewed: FamilyMember[]; candidates: FamilyMember[] } {
  return { reviewed: members.filter((m) => m.relationship_type !== 'candidate'), candidates: members.filter((m) => m.relationship_type === 'candidate') }
}

/** How many members of each relationship the family has. */
export function countByRelationship(members: readonly FamilyMember[]): Record<Relationship, number> {
  const counts: Record<Relationship, number> = { mutabaah_tammah: 0, mutabaah_qasirah: 0, shahid: 0, candidate: 0 }
  for (const m of members) if (isRelationship(m.relationship_type)) counts[m.relationship_type]++
  return counts
}

export type MemberSource = { kind: 'evidence'; id: number } | { kind: 'report'; id: number } | { kind: 'none' }

/** What a member is: a piece of evidence of this project, a report of the corpus, or (the server allows it) nothing. */
export function memberSource(m: Pick<FamilyMember, 'evidence_id' | 'corpus_hadith_id'>): MemberSource {
  if (m.evidence_id) return { kind: 'evidence', id: m.evidence_id }
  if (m.corpus_hadith_id) return { kind: 'report', id: m.corpus_hadith_id }
  return { kind: 'none' }
}

export const sourceCode = (s: MemberSource): string => (s.kind === 'evidence' ? evidenceCode(s.id) : s.kind === 'report' ? reportCode(s.id) : '')

/** Whether the person has already added this source to the family (the server would add it twice). */
export function alreadyInFamily(family: Pick<Family, 'members'>, source: { evidence_id?: number; corpus_hadith_id?: number }): boolean {
  return family.members.some((m) => (source.evidence_id && m.evidence_id === source.evidence_id) || (source.corpus_hadith_id && m.corpus_hadith_id === source.corpus_hadith_id))
}

/** The depth must be a whole number from 1 up; empty means not given. */
export function parseDepth(text: string): { ok: boolean; value?: number } {
  const t = text.trim()
  if (t === '') return { ok: true }
  const n = Number(t)
  return Number.isInteger(n) && n >= 1 && n <= 50 ? { ok: true, value: n } : { ok: false }
}
