import { describe, expect, it } from 'vitest'
import type { AlignedSlot } from '@/api/schemas/alignment'
import type { CorpusHadith } from '@/api/schemas/corpus'
import { alignmentInputs, countKinds, kindOf, reportText, sharedPercent, textLabel, visibleSlots } from './alignmentModel'

const report = (id: number, text: string | null, over: Partial<CorpusHadith> = {}) => ({ id, matn: text, clean_matn: null, full_hadith: null, references: [], ...over }) as unknown as CorpusHadith
const slot = (op: string, a: string | null = 'x', b: string | null = 'x'): AlignedSlot => ({ op, token_a: a, token_b: b })

describe('reportText', () => {
  it('prefers the printed matn, then the cleaned one, then the full report', () => {
    expect(reportText({ matn: ' a ', clean_matn: 'b', full_hadith: 'c' })).toBe('a')
    expect(reportText({ matn: null, clean_matn: 'b', full_hadith: 'c' })).toBe('b')
    expect(reportText({ matn: null, clean_matn: null, full_hadith: 'c' })).toBe('c')
    expect(reportText({ matn: null, clean_matn: null, full_hadith: null })).toBe('')
  })
})

describe('alignmentInputs', () => {
  const label = (r: CorpusHadith) => `R${r.id}`
  it('takes the chosen baseline first and aligns every other text against it', () => {
    const out = alignmentInputs([report(1, 'a b'), report(2, 'a c'), report(3, 'a d')], 2, label)
    expect(out.baseline?.id).toBe(2)
    expect(out.input).toEqual({ baseline_text: 'a c', variants: [{ id: 1, label: 'R1', text: 'a b' }, { id: 3, label: 'R3', text: 'a d' }] })
  })
  it('falls back to the first text with wording when the baseline is not among them', () => {
    expect(alignmentInputs([report(1, 'a'), report(2, 'b')], 9, label).baseline?.id).toBe(1)
  })
  it('leaves out a report with no wording and says which, rather than sending an empty text', () => {
    const out = alignmentInputs([report(1, 'a b'), report(2, null), report(3, 'a c')], undefined, label)
    expect(out.withoutText).toEqual([2])
    expect(out.input?.variants.map((v) => v.id)).toEqual([3])
  })
  it('makes no input from fewer than two texts with wording', () => {
    expect(alignmentInputs([report(1, 'a'), report(2, null)], undefined, label).input).toBeNull()
  })
})

describe('kinds and counts', () => {
  it('names each operation and counts them from the slots', () => {
    expect(kindOf(slot('match'))).toBe('same')
    expect(kindOf(slot('substitution'))).toBe('different')
    expect(kindOf(slot('insertion'))).toBe('added')
    expect(kindOf(slot('deletion'))).toBe('omitted')
    expect(kindOf(slot('wat'))).toBe('unknown')
    const counts = countKinds([slot('match'), slot('match'), slot('substitution'), slot('insertion')])
    expect(counts).toMatchObject({ same: 2, different: 1, added: 1, omitted: 0 })
    expect(sharedPercent(counts)).toBe(50)
    expect(sharedPercent(countKinds([]))).toBeNull()
  })
})

describe('visibleSlots', () => {
  const slots = [slot('match'), slot('match'), slot('match'), slot('substitution'), slot('match'), slot('match'), slot('match'), slot('match'), slot('deletion'), slot('match')]
  it('shows everything, or only the differences with one same-word slot of context each side', () => {
    expect(visibleSlots(slots, false)).toHaveLength(10)
    expect(visibleSlots(slots, true).map((x) => x.index)).toEqual([2, 3, 4, 7, 8, 9])
  })
  it('shows nothing when every word is the same and only differences are asked for', () => {
    expect(visibleSlots([slot('match'), slot('match')], true)).toEqual([])
  })
})

it('labels a text with its code and where it is found', () => {
  expect(textLabel({ id: 101, references: [{ book: { title: 'Abū Dāwūd' }, hadith_number: 57 }] } as unknown as CorpusHadith)).toBe('REP-000101 · Abū Dāwūd 57')
  expect(textLabel({ id: 101, references: [] } as unknown as CorpusHadith)).toBe('REP-000101')
})
