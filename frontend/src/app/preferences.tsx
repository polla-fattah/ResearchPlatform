import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_PREFERENCES,
  formatDate,
  formatNumber,
  formatRelative,
  type DisplayPreferences,
} from '@/i18n/format'
import { useNow } from '@/hooks/useNow'
import { isLanguage, type LanguageCode } from '@/i18n/languages'
import { useAuth } from './authContext'
import { PreferencesContext, type PreferencesValue } from './preferencesContext'

const KEY = 'oh.prefs'

function load(): DisplayPreferences {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<DisplayPreferences>) }
  } catch {
    /* ignore */
  }
  return DEFAULT_PREFERENCES
}

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

/**
 * Display preferences. While signed in with saved preferences the account's are the ones in use, on every device;
 * otherwise (signed out, or nothing saved yet) the ones kept in this browser. `setPrefs` writes to this browser only;
 * the settings screen saves to the account and the account's value then takes over.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation()
  const { user } = useAuth()
  const [local, setState] = useState<DisplayPreferences>(load)
  const prefs = accountPreferences(user?.profile?.display_preferences) ?? local
  const lang: LanguageCode = isLanguage(i18n.language) ? i18n.language : 'en'
  // "5 minutes ago" is measured from the shared app clock, which moves on once a minute.
  const now = useNow()

  const setPrefs = useCallback((next: Partial<DisplayPreferences>) => {
    setState((prev) => {
      const merged = { ...prev, ...next }
      try {
        localStorage.setItem(KEY, JSON.stringify(merged))
      } catch {
        /* ignore */
      }
      return merged
    })
  }, [])

  const value = useMemo<PreferencesValue>(
    () => ({
      prefs,
      setPrefs,
      n: (v) => formatNumber(v, lang, prefs),
      date: (v, opts) => formatDate(v, lang, prefs, opts),
      relative: (v) => formatRelative(v, lang, prefs, new Date(now)), // audit-ok: the app clock, not read in render
    }),
    [prefs, setPrefs, lang, now],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}
