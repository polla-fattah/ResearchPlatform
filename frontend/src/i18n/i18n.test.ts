import { describe, expect, it } from 'vitest'
import ckb from './locales/ckb.json'
import en from './locales/en.json'
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

describe('Arabic translations and terminology', () => {
  it('loads core scholarly Hadith terms in Arabic', async () => {
    const { default: i18n, initI18n, loadLanguage } = await import('./index')
    initI18n('ar')
    await loadLanguage('ar')
    expect(i18n.t('app.name', { lng: 'ar' })).toBe('منصة أبحاث الحديث الشريف')
    expect(i18n.t('nav.library', { lng: 'ar' })).toBe('مكتبتي')
    expect(i18n.t('nav.projects', { lng: 'ar' })).toBe('المشاريع البحثية')
    expect(i18n.t('analysisTools.isnad', { lng: 'ar' })).toBe('رسم شجرة الإسناد')
    expect(i18n.t('analysisTools.ilal', { lng: 'ar' })).toBe('دراسة العلل الحديثية')
    expect(i18n.t('analysisTools.matn', { lng: 'ar' })).toBe('محاذاة المتون')
  })
})

/** Every string of a nested locale file, by its dotted key. */
function leaves(node: unknown, path = ''): [string, string][] {
  if (node && typeof node === 'object') return Object.entries(node).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k))
  return [[path, String(node)]]
}
const placeholders = (text: string) => (text.match(/\{\{[^}]+\}\}/g) ?? []).sort()

describe('Sorani translation', () => {
  const english = new Map(leaves(en))
  const sorani = new Map(leaves(ckb))

  it('has every string the English file has, and no others', () => {
    expect([...english.keys()].filter((k) => !sorani.has(k))).toEqual([])
    expect([...sorani.keys()].filter((k) => !english.has(k))).toEqual([])
  })

  it('keeps every {{placeholder}} of the English string, and leaves none empty', () => {
    const wrong = [...sorani].filter(([k, v]) => v.trim() === '' || placeholders(v).join() !== placeholders(english.get(k) ?? '').join()).map(([k]) => k)
    expect(wrong).toEqual([])
  })
})
