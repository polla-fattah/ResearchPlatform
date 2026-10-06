import { DEFAULT_PREFERENCES, type DisplayPreferences } from '@/i18n/format'
import { isLanguage } from '@/i18n/languages'

/**
 * What the person saved with their account, or null when they never did (the server then sends its own defaults
 * at the top level of /auth/me, which must not be mistaken for a choice).
 */
export function accountPreferences(saved: { numerals?: string | null; calendar?: string | null; time_zone?: string | null; default_content_language?: string | null } | null | undefined): DisplayPreferences | null {
  if (!saved) return null
  const base = DEFAULT_PREFERENCES
  return {
    numerals: saved.numerals === 'eastern_arabic' || saved.numerals === 'western' ? saved.numerals : base.numerals,
    calendar: saved.calendar === 'gregorian_hijri' || saved.calendar === 'hijri_gregorian' || saved.calendar === 'gregorian' ? saved.calendar : base.calendar,
    timeZone: saved.time_zone || base.timeZone,
    contentLanguage: isLanguage(saved.default_content_language) ? saved.default_content_language : base.contentLanguage,
  }
}
