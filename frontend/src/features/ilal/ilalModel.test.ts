import { describe, expect, it } from 'vitest'
import { canResolve, caseCode, countByStatus, criticText, isOpen, preferredIndex, variantLabel } from './ilalModel'

describe('ʿilal model', () => {
  it('labels a version by name, then narrator, then position', () => {
    expect(variantLabel({ name: ' A ' }, 0)).toBe('A')
    expect(variantLabel({ narrator: 'Ḥammād' }, 1)).toBe('Ḥammād')
    expect(variantLabel({}, 2)).toBe('#3')
  })
  it('finds the preferred version only when it matches a label', () => {
    const variants = [{ name: 'A' }, { name: 'B' }]
    expect(preferredIndex({ competing_variants: variants, preferred_version: 'B' })).toBe(1)
    expect(preferredIndex({ competing_variants: variants, preferred_version: 'other text' })).toBe(-1)
    expect(preferredIndex({ competing_variants: variants, preferred_version: null })).toBe(-1)
  })
  it('needs two versions to resolve, and counts statuses', () => {
    expect(canResolve({ competing_variants: [{}] })).toBe(false)
    expect(canResolve({ competing_variants: [{}, {}] })).toBe(true)
    expect(isOpen({ status: 'under_investigation' })).toBe(true)
    expect(countByStatus([{ status: 'inconclusive' }, { status: 'inconclusive' }, { status: 'weird' }]).inconclusive).toBe(2)
  })
  it('formats the code and reads a critic under either field name', () => {
    expect(caseCode(3)).toBe('IC-0003')
    expect(criticText({ verdict: ' x ' })).toBe('x')
    expect(criticText({ quote: 'q' })).toBe('q')
  })
})
