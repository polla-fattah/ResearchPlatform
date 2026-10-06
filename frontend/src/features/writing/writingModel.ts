import type { CitationMode, Finding, FindingEvidence, Relation } from '@/api/schemas/writing'
import { RELATIONS } from '@/api/schemas/writing'
import { formatCode, parseCode } from '@/domain/codes'

export const findingCode = (id: number) => formatCode('F', id)

// ---- citations in the text ----------------------------------------------------------------------------------------
// The text cites evidence with `[@EV-0004]`, `[@EV-0004 exact]` or `[@EV-0004 paraphrase]` (screen 11, WRT-03).

export type CiteKind = 'exact' | 'paraphrase' | 'ref'

const MARKER = /\[@(EV-\d+)(?:\s+(exact|paraphrase|ref))?\]/g

export const kindToMode = (kind: CiteKind): CitationMode =>
  kind === 'exact' ? 'direct_quotation' : kind === 'paraphrase' ? 'paraphrase' : 'reference'

export interface CitedEvidence {
  /** Evidence id (EV-0004 is 4). */
  id: number
  code: string
  /** 1-based, in order of first appearance: the number shown in the text and in the citation list. */
  number: number
  /** Every way this evidence is cited in the text. */
  kinds: CiteKind[]
}

/** The distinct evidence cited in the text, numbered by first appearance. */
export function extractCitations(text: string): CitedEvidence[] {
  const out: CitedEvidence[] = []
  for (const m of text.matchAll(MARKER)) {
    const code = m[1]!
    const parsed = parseCode(code)
    if (!parsed || parsed.prefix !== 'EV') continue
    const kind: CiteKind = (m[2] as CiteKind | undefined) ?? 'ref'
    const existing = out.find((c) => c.id === parsed.id)
    if (existing) {
      if (!existing.kinds.includes(kind)) existing.kinds.push(kind)
    } else {
      out.push({ id: parsed.id, code, number: out.length + 1, kinds: [kind] })
    }
  }
  return out
}

/** The text to insert at the cursor for a citation. An exact quotation carries the captured wording unchanged. */
export function citationText(code: string, kind: CiteKind, quote?: string | null): string {
  if (kind === 'exact') {
    const wording = (quote ?? '').trim().replace(/\s*\n\s*/g, ' ')
    return `${wording ? `> «${wording}» ` : ''}[@${code} exact]`
  }
  if (kind === 'paraphrase') return `[@${code} paraphrase]`
  return `[@${code}]`
}

// ---- findings -------------------------------------------------------------------------------------------------------

export function groupByRelation(items: readonly FindingEvidence[]): Record<Relation, FindingEvidence[]> {
  const groups = Object.fromEntries(RELATIONS.map((r) => [r, [] as FindingEvidence[]])) as Record<Relation, FindingEvidence[]>
  for (const item of items) {
    const relation = (RELATIONS as readonly string[]).includes(item.pivot?.relation_type ?? '')
      ? (item.pivot!.relation_type as Relation)
      : 'unresolved'
    groups[relation].push(item)
  }
  return groups
}

/**
 * What a finding still lacks for a public submission (WRT-02). It is only a reminder: nothing is blocked until
 * the researcher submits the finding for publication.
 */
export function submissionGaps(finding: Pick<Finding, 'limitations' | 'evidence_items'>): ('limitations' | 'counter')[] {
  const gaps: ('limitations' | 'counter')[] = []
  if (!finding.limitations?.trim()) gaps.push('limitations')
  const groups = groupByRelation(finding.evidence_items ?? [])
  if (groups.opposing.length + groups.unresolved.length === 0) gaps.push('counter')
  return gaps
}

// ---- what the editor opens with ------------------------------------------------------------------------------------

export interface EditorStart {
  text: string
  baseVersion: number
  status: 'saved' | 'dirty' | 'draftSaved'
  /** Set when unsaved text from an earlier session was brought back. */
  restored: { at: number; source: 'server' | 'local' } | null
}

/**
 * A draft is only offered back if it was written on top of the version that is current now. The server keeps a
 * person's draft after a version has replaced it (request file C-18), and putting that older text over a newer
 * version would silently undo work. Text kept in this browser while offline wins over the server's draft, because it
 * is newer, and is sent again at once (status `dirty`).
 */
export function chooseStart(
  head: { version_number: number; content: string },
  serverDraft: { draft_content?: string | null; draft_base_version?: number | null; last_saved_at?: string | null } | null,
  local: { text: string; baseVersion: number; at: number } | null,
): EditorStart {
  const plain: EditorStart = { text: head.content, baseVersion: head.version_number, status: 'saved', restored: null }
  if (local && local.baseVersion === head.version_number && local.text !== head.content) {
    return { text: local.text, baseVersion: head.version_number, status: 'dirty', restored: { at: local.at, source: 'local' } }
  }
  if (
    serverDraft?.draft_content &&
    serverDraft.draft_base_version === head.version_number &&
    serverDraft.draft_content !== head.content
  ) {
    const at = serverDraft.last_saved_at ? Date.parse(serverDraft.last_saved_at) : NaN
    return {
      text: serverDraft.draft_content,
      baseVersion: head.version_number,
      status: 'draftSaved',
      restored: { at: Number.isNaN(at) ? 0 : at, source: 'server' },
    }
  }
  return plain
}
