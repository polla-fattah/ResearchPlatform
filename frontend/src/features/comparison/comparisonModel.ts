import type { CorpusHadith } from '@/api/schemas/corpus'
import type { AnalysisRun } from '@/api/schemas/analyses'
import { formatCode } from '@/domain/codes'

/** The four views of the workspace. In the address: `?view=occ|chains|dossier|crit`. */
export const VIEWS = ['occ', 'chains', 'dossier', 'crit'] as const
export type View = (typeof VIEWS)[number]

/** The design's range for a comparison of occurrences. */
export const MIN_REPORTS = 2
export const MAX_REPORTS = 6
/** More chains than this are listed but not drawn side by side. */
export const MAX_CHAINS = 12
export const MAX_NARRATORS = 6

export const analysisCode = (id: number) => formatCode('AN', id)
export const reportCode = (id: number) => formatCode('REP', id)
export const narratorCode = (id: number) => formatCode('NAR', id)

/** "1,2,3" → [1, 2, 3]: whole positive numbers, no repeats, in order. Anything else in the text is dropped. */
export function parseIds(text: string, max = Infinity): number[] {
  const seen = new Set<number>()
  for (const part of text.split(',')) {
    const n = Number(part)
    if (Number.isInteger(n) && n > 0) seen.add(n)
  }
  return [...seen].slice(0, max)
}
export const idsParam = (ids: readonly number[]): string => ids.join(',')

// ── Arabic words ──────────────────────────────────────────────────────────────────────────────────────────────
/** The server's normalisation (`AnalysisWorkbenchService::normalizeArabic`), so words can be matched with its tokens. */
export function normalizeArabic(text: string): string {
  return text
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[.,:;()[\]«»\-!؟?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
const tokenize = (text: string): string[] => {
  const normalized = normalizeArabic(text)
  return normalized === '' ? [] : normalized.split(' ')
}

export interface MarkedWord {
  text: string
  /** `shared`: the word is in every text. `some`: it is missing from at least one. `plain`: spacing or punctuation. */
  role: 'shared' | 'some' | 'plain'
}

/**
 * Splits a text's original wording into words and says which of them every compared text has. The words are matched
 * with the server's tokens, never by guessing: if the original wording does not line up with the tokens (the server
 * split it differently), this returns null and the text is shown without marks rather than with wrong ones.
 */
export function markWords(raw: string, tokens: readonly string[], shared: ReadonlySet<string>): MarkedWord[] | null {
  const parts = raw.split(/(\s+)/).filter((p) => p !== '')
  const found: string[] = []
  const marked = parts.map((text): MarkedWord => {
    const own = /^\s+$/.test(text) ? [] : tokenize(text)
    found.push(...own)
    if (own.length === 0) return { text, role: 'plain' }
    return { text, role: own.every((w) => shared.has(w)) ? 'shared' : 'some' }
  })
  return found.length === tokens.length && found.every((w, i) => w === tokens[i]) ? marked : null
}

// ── Stored runs ───────────────────────────────────────────────────────────────────────────────────────────────
export const RUN_VIEW: Record<string, View | undefined> = {
  matn_comparison: 'occ',
  isnad_comparison: 'chains',
  narrator_dossier: 'dossier',
  criticism_matrix: 'crit',
}

/** Newest first; runs stored in the same second (the server does not order them) by id. */
export function sortRuns(runs: readonly AnalysisRun[]): AnalysisRun[] {
  return [...runs].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '') || b.id - a.id)
}

const idList = (value: unknown): number[] | null =>
  Array.isArray(value) && value.length > 0 && value.every((v) => Number.isInteger(v) && v > 0) ? (value as number[]) : null

/** What a stored run was made from, when it says so in a form the screen can use again. */
export type RunInputs =
  { kind: 'matn'; hadithIds: number[] } | { kind: 'isnads'; sanadIds: number[] } | { kind: 'criticism'; narratorIds: number[] }

export function inputsOf(run: AnalysisRun): RunInputs | null {
  const p = run.input_params
  if (run.analysis_type === 'matn_comparison') {
    const ids = idList(p.hadith_ids)
    return ids && ids.length >= MIN_REPORTS ? { kind: 'matn', hadithIds: ids } : null
  }
  if (run.analysis_type === 'isnad_comparison') {
    const ids = idList(p.sanad_ids)
    return ids && ids.length >= 2 ? { kind: 'isnads', sanadIds: ids } : null
  }
  if (run.analysis_type === 'criticism_matrix') {
    const ids = idList(p.narrator_ids)
    return ids ? { kind: 'criticism', narratorIds: ids } : null
  }
  return null
}

// ── Chains of the compared reports ────────────────────────────────────────────────────────────────────────────
export interface ChainSource {
  sanadId: number
  reportId: number
  book: string
  number: number | null
}

/** Every chain of the given reports, in the order the corpus lists them, with where it is found. */
export function chainSources(reports: readonly CorpusHadith[]): ChainSource[] {
  return reports.flatMap((report) =>
    (report.references ?? []).flatMap((reference) =>
      (reference.sanads ?? []).map((sanad) => ({
        sanadId: sanad.id,
        reportId: report.id,
        book: reference.book?.title ?? '',
        number: reference.hadith_number ?? null,
      })),
    ),
  )
}

/** One place a report is found, for a column header: "book · number". */
export function occurrenceLabel(report: CorpusHadith | undefined): {
  book: string
  number: number | null
  extra: number
} {
  const refs = report?.references ?? []
  return {
    book: refs[0]?.book?.title ?? '',
    number: refs[0]?.hadith_number ?? null,
    extra: Math.max(0, refs.length - 1),
  }
}

/** "Occurrence comparison · v2": what kind of analysis it is and which version of that kind. */
export const runTitle = (t: (key: string, o?: Record<string, unknown>) => string, run: AnalysisRun) =>
  t('comparison.run.title', { kind: t(`comparison.run.types.${run.analysis_type}`, { defaultValue: run.analysis_type }), version: run.version_number })
