import type { EvidenceItem } from '@/api/schemas/evidence'
import { formatCode } from '@/domain/codes'
import type { EvidenceState } from '@/domain/vocab'

export const evidenceCode = (id: number) => formatCode('EV', id)

/** Excluded and Unresolved always need a stated reason (EVI-02). */
export const needsReason = (state: string): boolean => state === 'excluded' || state === 'unresolved'

type Resource = NonNullable<EvidenceItem['resource']>

const metaOf = (r: Resource): Record<string, unknown> =>
  r.source_metadata && typeof r.source_metadata === 'object' && !Array.isArray(r.source_metadata)
    ? (r.source_metadata as Record<string, unknown>)
    : {}

/** The report record (hadith) behind a piece of evidence, when its source is a corpus report or occurrence. */
export function hadithIdOf(r: Resource | null | undefined): number | null {
  if (!r) return null
  if (r.corpus_table === 'hadiths' && r.corpus_id) return r.corpus_id
  const fromMeta = metaOf(r).hadith_id
  if (r.corpus_table === 'hadith_references' && typeof fromMeta === 'number') return fromMeta
  return null
}

/** What a correction proposal can point at. The API accepts hadiths, narrators, books and sanads. */
export function correctionTarget(r: Resource | null | undefined): { corpus_table: 'hadiths' | 'narrators' | 'books'; corpus_id: number; code: string } | null {
  if (!r?.corpus_id) return null
  if (r.corpus_table === 'narrators') return { corpus_table: 'narrators', corpus_id: r.corpus_id, code: formatCode('NAR', r.corpus_id) }
  if (r.corpus_table === 'books') return { corpus_table: 'books', corpus_id: r.corpus_id, code: formatCode('BK', r.corpus_id) }
  const hadith = hadithIdOf(r)
  if (hadith) {
    return {
      corpus_table: 'hadiths',
      corpus_id: hadith,
      code: r.corpus_table === 'hadith_references' ? formatCode('OCC', r.corpus_id) : formatCode('REP', hadith),
    }
  }
  return null
}

export const stateOf = (s: string): EvidenceState | null =>
  (['candidate', 'included', 'reviewed', 'excluded', 'unresolved'] as const).find((x) => x === s) ?? null

