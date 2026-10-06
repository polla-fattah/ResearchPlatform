import { describe, expect, it } from 'vitest'
import { applyDocumentLanguage } from './index'
import { DEFAULT_PREFERENCES, formatDate, formatNumber } from './format'

describe('document language and direction', () => {
  it('flips the whole interface to RTL for Sorani and Arabic', () => {
    const root = document.createElement('html')
    applyDocumentLanguage('ckb', root)
    expect(root.dir).toBe('rtl')
    expect(root.lang).toBe('ckb')
    applyDocumentLanguage('ar', root)
    expect(root.dir).toBe('rtl')
    applyDocumentLanguage('en', root)
    expect(root.dir).toBe('ltr')
  })
})

describe('numerals and dates', () => {
  it('uses Eastern Arabic numerals when the preference says so', () => {
    const prefs = { ...DEFAULT_PREFERENCES, numerals: 'eastern_arabic' as const }
    expect(formatNumber(1234, 'ar', prefs)).toMatch(/[٠-٩]/)
    expect(formatNumber(1234, 'en', DEFAULT_PREFERENCES)).toBe('1,234')
  })

  it('shows Gregorian only, or Gregorian with Hijri', () => {
    const date = '2026-10-04T08:30:00Z'
    const greg = formatDate(date, 'en', { ...DEFAULT_PREFERENCES, calendar: 'gregorian' })
    expect(greg).toContain('2026')
    expect(greg).not.toContain('·')
    const both = formatDate(date, 'en', { ...DEFAULT_PREFERENCES, calendar: 'gregorian_hijri' })
    expect(both).toContain('·')
    expect(both).toContain('1448') // the mockup shows 22 Rabīʿ II 1448 for 4 Oct 2026
  })

  it('returns an empty string for an invalid date instead of throwing', () => {
    expect(formatDate('not a date', 'en', DEFAULT_PREFERENCES)).toBe('')
  })
})
