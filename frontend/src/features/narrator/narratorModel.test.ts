import { describe, expect, it } from 'vitest'
import { alternativeClaim, alternativeSource, groupByTeacher, isUncertainty, parseNarratorId, placeName, yearsLabel } from './narratorModel'

const a = (id: number, teacher: number, at: string) => ({ id, narrator_id: 1, teacher_id: teacher, assessment_category: 'sound', qawl_text: 'x', created_at: at })

describe('narrator model', () => {
  it('reads an alternative stored as text or as an object', () => {
    expect(alternativeClaim(' 197 AH ')).toBe('197 AH')
    expect(alternativeClaim({ claim: '198 AH', source: 'Taqrīb' })).toBe('198 AH')
    expect(alternativeSource({ claim: 'c', source: ' Taqrīb ' })).toBe('Taqrīb')
    expect(alternativeSource('plain')).toBe('')
  })
  it('groups assessments by teacher, newest first', () => {
    const groups = groupByTeacher([a(1, 5, '2026-01-01'), a(2, 6, '2026-01-02'), a(3, 5, '2026-02-01')])
    expect(groups.map((g) => g.teacherId)).toEqual([5, 6])
    expect(groups[0]!.items.map((x) => x.id)).toEqual([3, 1])
  })
  it('keeps a missing year unknown and shows ranges as recorded', () => {
    expect(yearsLabel({})).toBeNull()
    expect(yearsLabel({ year_start: 40, year_end: 45 })).toBe('40–45')
    expect(yearsLabel({ year_start: 40, year_end: 40 })).toBe('40')
    expect(yearsLabel({ year_end: 197 })).toBe('197')
    expect(yearsLabel({ year_start: 0 })).toBe('0')
  })
  it('chooses the place name in the reading language and falls back', () => {
    expect(placeName({ place_name_ar: 'الكوفة', place_name_en: 'Kufa' }, 'en')).toBe('Kufa')
    expect(placeName({ place_name_ar: 'الكوفة', place_name_en: null }, 'en')).toBe('الكوفة')
    expect(placeName({}, 'ar')).toBeNull()
  })
  it('validates ids and levels', () => {
    expect(parseNarratorId('118')).toBe(118)
    expect(parseNarratorId('0')).toBeNull()
    expect(parseNarratorId('1e3')).toBeNull()
    expect(parseNarratorId(undefined)).toBeNull()
    expect(isUncertainty('contested')).toBe(true)
    expect(isUncertainty('maybe')).toBe(false)
  })
})
