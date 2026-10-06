/**
 * Who may know what in peer review (SRS PUB-04, PUB-05). The server sends more than each person may see (request file
 * C-29, C-31), so each side's schema names only the fields that person may read and drops the rest at parse time. These
 * lists are the rule written down once; the tests parse a worst-case payload with every one of these keys through each
 * side's schema and prove none survives.
 */

/** What the AUTHORS of a package never see: who reviewed it, what a reviewer wrote or scored, and the editor's account. */
export const HIDDEN_FROM_AUTHORS = ['reviewer_id', 'reviewer', 'reviewer_notes', 'score', 'recommendation', 'coi_notes'] as const

/** What a REVIEWER never sees: who the authors are, and the project the package came from. */
export const HIDDEN_FROM_REVIEWERS = ['submitted_by', 'submitter', 'project_id', 'owner', 'owner_id', 'collector_id', 'author_id', 'email'] as const

/** True when the value, at any depth, has a key from the list. */
export function containsKey(value: unknown, keys: readonly string[]): boolean {
  if (Array.isArray(value)) return value.some((v) => containsKey(v, keys))
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([k, v]) => keys.includes(k) || containsKey(v, keys))
  }
  return false
}
