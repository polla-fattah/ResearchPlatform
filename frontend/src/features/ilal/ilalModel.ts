import { CASE_STATUSES, DISCREPANCIES, type CaseStatus, type Critic, type Discrepancy, type IlalCase, type Variant } from '@/api/schemas/ilal'

export const isDiscrepancy = (v: string): v is Discrepancy => (DISCREPANCIES as readonly string[]).includes(v)
export const isCaseStatus = (v: string): v is CaseStatus => (CASE_STATUSES as readonly string[]).includes(v)

/** A case is open until a researcher says otherwise. */
export const isOpen = (c: Pick<IlalCase, 'status'>) => c.status === 'under_investigation'

export const caseCode = (id: number) => `IC-${String(id).padStart(4, '0')}`

/** What to call a version: its name, else the narrator the server's own examples use, else its position. */
export function variantLabel(v: Variant, index: number): string {
  return (v.name ?? '').trim() || (v.narrator ?? '').trim() || `#${index + 1}`
}

/** A case needs two versions to compare before it can be closed with a preference. */
export const canResolve = (c: Pick<IlalCase, 'competing_variants'>) => c.competing_variants.length >= 2

/**
 * The preferred version is stored as free text. It counts as "one of the versions" only when it equals a version's label,
 * which is how the screen sets it; text written by another client is still shown, flagged as not matching.
 */
export function preferredIndex(c: Pick<IlalCase, 'competing_variants' | 'preferred_version'>): number {
  const wanted = (c.preferred_version ?? '').trim()
  if (!wanted) return -1
  return c.competing_variants.findIndex((v, i) => variantLabel(v, i) === wanted)
}

/** One line for a critic statement, whichever of the stored field names it used. */
export const criticText = (c: Critic) => (c.verdict ?? c.quote ?? '').trim()

export function countByStatus(cases: readonly Pick<IlalCase, 'status'>[]): Record<CaseStatus, number> {
  const counts = { under_investigation: 0, resolved_authentic: 0, resolved_defective: 0, inconclusive: 0 }
  for (const c of cases) if (isCaseStatus(c.status)) counts[c.status]++
  return counts
}
