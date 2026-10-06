import { describe, expect, it } from 'vitest'
import type { AnalysisRun } from '@/api/schemas/analyses'
import {
  analysisCode,
  chainSources,
  idsParam,
  inputsOf,
  markWords,
  narratorCode,
  normalizeArabic,
  occurrenceLabel,
  parseIds,
  reportCode,
  sortRuns,
} from './comparisonModel'

const run = (over: Partial<AnalysisRun> = {}): AnalysisRun => ({
  id: 1,
  project_id: 12,
  analysis_type: 'matn_comparison',
  input_params: {},
  output_data: {},
  version_number: 1,
  created_at: '2026-10-01T10:00:00Z',
  ...over,
})

describe('codes', () => {
  it('pads the ids the way the design writes them', () => {
    expect(analysisCode(15)).toBe('AN-0015')
    expect(reportCode(318)).toBe('REP-000318')
    expect(narratorCode(512)).toBe('NAR-000512')
  })
})

describe('parseIds', () => {
  it('keeps whole positive numbers once each, in order, and drops the rest', () => {
    expect(parseIds('3,1,3,x,0,-2,4.5,,7')).toEqual([3, 1, 7])
    expect(parseIds('')).toEqual([])
  })
  it('can cap the list, and round-trips with idsParam', () => {
    expect(parseIds('1,2,3,4', 2)).toEqual([1, 2])
    expect(parseIds(idsParam([5, 6]))).toEqual([5, 6])
  })
})

describe('normalizeArabic (the server’s rules)', () => {
  it('removes marks, unifies alef, taa marbuta and alef maqsura, and turns punctuation into spaces', () => {
    expect(normalizeArabic('إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ')).toBe('انما الاعمال بالنيات')
    expect(normalizeArabic('نية المؤمن, خير')).toBe('نيه المؤمن خير')
    expect(normalizeArabic('المؤمن، خير')).toBe('المؤمن، خير') // the Arabic comma is not in the server's list
    expect(normalizeArabic('على')).toBe('علي')
  })
})

describe('markWords', () => {
  const tokens = ['انما', 'الاعمال', 'بالنيات']
  it('marks each word of the original wording by whether every text has it, keeping the original letters and spacing', () => {
    const marked = markWords('إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ', tokens, new Set(['الاعمال']))!
    expect(marked.map((m) => m.text).join('')).toBe('إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ')
    expect(marked.filter((m) => m.role !== 'plain').map((m) => m.role)).toEqual(['some', 'shared', 'some'])
  })
  it('gives up (null) instead of marking the wrong words when the wording does not line up with the server’s tokens', () => {
    expect(markWords('إنما الأعمال', tokens, new Set())).toBeNull()
    expect(markWords('إنما الأعمال بالنية', tokens, new Set())).toBeNull()
  })
  it('treats a word that the server split in two (a hyphen) as one word that is shared only if both parts are', () => {
    const marked = markWords('ابن-عباس قال', ['ابن', 'عباس', 'قال'], new Set(['ابن', 'قال']))!
    expect(marked.filter((m) => m.role !== 'plain').map((m) => m.role)).toEqual(['some', 'shared'])
  })
  it('handles an empty text', () => {
    expect(markWords('', [], new Set())).toEqual([])
  })
})

describe('sortRuns', () => {
  it('puts the newest first and breaks a tie by id, because the server leaves same-second runs in any order', () => {
    const sorted = sortRuns([run({ id: 1 }), run({ id: 3, created_at: '2026-10-02T10:00:00Z' }), run({ id: 2 })])
    expect(sorted.map((r) => r.id)).toEqual([3, 2, 1])
  })
})

describe('inputsOf', () => {
  it('reads what a run was made from when it says so', () => {
    expect(inputsOf(run({ input_params: { hadith_ids: [1, 2] } }))).toEqual({
      kind: 'matn',
      hadithIds: [1, 2],
    })
    expect(
      inputsOf(
        run({
          analysis_type: 'isnad_comparison',
          input_params: { sanad_ids: [4, 5] },
        }),
      ),
    ).toEqual({ kind: 'isnads', sanadIds: [4, 5] })
    expect(
      inputsOf(
        run({
          analysis_type: 'criticism_matrix',
          input_params: { narrator_ids: [9] },
        }),
      ),
    ).toEqual({ kind: 'criticism', narratorIds: [9] })
  })
  it('says nothing for the demo runs, whose inputs are names or counts, and for a matn run with one text', () => {
    expect(
      inputsOf(
        run({
          analysis_type: 'criticism_matrix',
          input_params: { target_narrators: ['Yahya'] },
        }),
      ),
    ).toBeNull()
    expect(
      inputsOf(
        run({
          analysis_type: 'isnad_comparison',
          input_params: { chains_analyzed: 4 },
        }),
      ),
    ).toBeNull()
    expect(inputsOf(run({ input_params: { hadith_ids: [1] } }))).toBeNull()
    expect(inputsOf(run({ analysis_type: 'sequence_collation' }))).toBeNull()
  })
})

describe('chains of reports', () => {
  const report = {
    id: 7,
    matn: 'x',
    clean_matn: null,
    references: [
      {
        id: 1,
        hadith_id: 7,
        hadith_number: 106,
        book: { id: 1, title: 'Sunan Abī Dāwūd' },
        sanads: [{ id: 11, reference_id: 1 }],
      },
      {
        id: 2,
        hadith_id: 7,
        book: { id: 2, title: 'al-Tirmidhī' },
        sanads: [
          { id: 12, reference_id: 2 },
          { id: 13, reference_id: 2 },
        ],
      },
    ],
  }
  it('lists every chain with where it is found', () => {
    expect(chainSources([report as never])).toEqual([
      { sanadId: 11, reportId: 7, book: 'Sunan Abī Dāwūd', number: 106 },
      { sanadId: 12, reportId: 7, book: 'al-Tirmidhī', number: null },
      { sanadId: 13, reportId: 7, book: 'al-Tirmidhī', number: null },
    ])
  })
  it('labels a report by its first place and says how many others there are', () => {
    expect(occurrenceLabel(report as never)).toEqual({
      book: 'Sunan Abī Dāwūd',
      number: 106,
      extra: 1,
    })
    expect(occurrenceLabel(undefined)).toEqual({
      book: '',
      number: null,
      extra: 0,
    })
  })
})
