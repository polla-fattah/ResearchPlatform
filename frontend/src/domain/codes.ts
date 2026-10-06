/**
 * Display codes. The API only has numeric ids, so codes are formatted client-side.
 * Decision (plan §9.1): corpus occurrences are `OCC-<referenceId>`; book, volume/page and
 * source number are separate fields, never embedded in the code.
 */
const WIDTH = {
  PRJ: 4, // project
  EV: 4, // evidence
  F: 2, // finding
  D: 4, // discussion thread
  T: 4, // task
  SUB: 4, // submission
  EXP: 4, // export job
  SQ: 4, // saved query
  COR: 4, // corpus correction proposal
  APP: 4, // application (reference is also given by the API when it exists)
  ACC: 4, // account
  AUD: 5, // audit entry
  OCC: 6, // corpus occurrence (hadith reference)
  REP: 6, // corpus report record (hadith)
  NAR: 6, // corpus narrator
  CH: 6, // corpus chain (sanad)
  BK: 4, // corpus book
  EXT: 4, // external reference
  LIB: 4, // library entry when the source has no corpus id
  RES: 4, // project resource
  RS: 4, // result set
  AN: 4, // analysis
  AMB: 4, // ambiguity record
} as const

export type CodePrefix = keyof typeof WIDTH

export function formatCode(prefix: CodePrefix, id: number): string {
  return `${prefix}-${String(id).padStart(WIDTH[prefix], '0')}`
}

/** Inverse of formatCode, used by the Markdown citation syntax `[@EV-0004 exact]`. */
export function parseCode(code: string): { prefix: CodePrefix; id: number } | null {
  const m = /^([A-Z]+)-(\d+)$/.exec(code.trim())
  if (!m) return null
  const prefix = m[1] as CodePrefix
  if (!(prefix in WIDTH)) return null
  return { prefix, id: Number(m[2]) }
}
