import type { AlignedSlot, Alignment, Collation, Operation } from '@/api/schemas/alignment'
import type { CorpusHadith } from '@/api/schemas/corpus'
import type { CollateInput } from '@/api/alignment'
import { OPERATIONS } from '@/api/schemas/alignment'
import { reportCode } from '@/features/comparison/comparisonModel'

export const MIN_TEXTS = 2
export const MAX_TEXTS = 6

/** The wording of a report: the printed matn, else the cleaned one, else the full report. Empty when the corpus has none. */
export const reportText = (r: Pick<CorpusHadith, 'matn' | 'clean_matn' | 'full_hadith'>): string => (r.matn ?? r.clean_matn ?? r.full_hadith ?? '').trim()

export const isOperation = (op: string): op is Operation => (OPERATIONS as readonly string[]).includes(op)

/**
 * The inputs of an alignment: the baseline's text and every other chosen text. A report with no wording cannot be
 * aligned: it is left out and reported, not sent as an empty text (an empty text would read as "everything omitted").
 */
export function alignmentInputs(
  reports: readonly CorpusHadith[],
  baselineId: number | undefined,
  label: (r: CorpusHadith) => string,
): { input: CollateInput | null; baseline: CorpusHadith | null; withoutText: number[] } {
  const withText = reports.filter((r) => reportText(r) !== '')
  const withoutText = reports.filter((r) => reportText(r) === '').map((r) => r.id)
  const baseline = withText.find((r) => r.id === baselineId) ?? withText[0] ?? null
  if (!baseline || withText.length < MIN_TEXTS) return { input: null, baseline, withoutText }
  return {
    input: {
      baseline_text: reportText(baseline),
      variants: withText.filter((r) => r.id !== baseline.id).map((r) => ({ id: r.id, label: label(r), text: reportText(r) })),
    },
    baseline,
    withoutText,
  }
}

export type Kind = 'same' | 'different' | 'added' | 'omitted' | 'unknown'
export const kindOf = (slot: Pick<AlignedSlot, 'op'>): Kind =>
  ({ match: 'same', substitution: 'different', insertion: 'added', deletion: 'omitted' } as Record<string, Kind>)[slot.op] ?? 'unknown'

/** How many slots of each kind; read from the slots themselves, not from the server's summary. */
export function countKinds(slots: readonly AlignedSlot[]): Record<Kind, number> {
  const counts: Record<Kind, number> = { same: 0, different: 0, added: 0, omitted: 0, unknown: 0 }
  for (const s of slots) counts[kindOf(s)]++
  return counts
}

/** The slots to show: all of them, or only where the texts differ (with the neighbouring same-word slots as context). */
export function visibleSlots(slots: readonly AlignedSlot[], onlyDifferences: boolean, context = 1): { index: number; slot: AlignedSlot }[] {
  const all = slots.map((slot, index) => ({ index, slot }))
  if (!onlyDifferences) return all
  const keep = new Set<number>()
  slots.forEach((s, i) => {
    if (kindOf(s) !== 'same') for (let k = Math.max(0, i - context); k <= Math.min(slots.length - 1, i + context); k++) keep.add(k)
  })
  return all.filter((x) => keep.has(x.index))
}

/** Share of aligned slots with the same word, as a whole number; null when there is nothing aligned. */
export function sharedPercent(counts: Record<Kind, number>): number | null {
  const total = counts.same + counts.different + counts.added + counts.omitted
  return total === 0 ? null : Math.round((counts.same / total) * 100)
}

/** "REP-000101 · Abū Dāwūd 1/57", or just the code when the report has no reference. */
export function textLabel(r: Pick<CorpusHadith, 'id' | 'references'>): string {
  const ref = r.references?.[0]
  const where = ref?.book?.title ? `${ref.book.title}${ref.hadith_number ? ` ${ref.hadith_number}` : ''}` : ''
  return where ? `${reportCode(r.id)} · ${where}` : reportCode(r.id)
}

/** The summary the screen shows for one variant: counts from the slots, so it can never disagree with the table drawn from them. */
export const summaryOf = (a: Alignment) => {
  const counts = countKinds(a.operations)
  return { counts, percent: sharedPercent(counts) }
}

export const variantsOf = (c: Collation) => c.comparisons
