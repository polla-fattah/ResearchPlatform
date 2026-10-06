import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_PREFERENCES,
  formatDate,
  formatNumber,
  formatRelative,
  type DisplayPreferences,
} from '@/i18n/format'
import { isLanguage, type LanguageCode } from '@/i18n/languages'
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

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation()
  const [prefs, setState] = useState<DisplayPreferences>(load)
  const lang: LanguageCode = isLanguage(i18n.language) ? i18n.language : 'en'

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
      relative: (v) => formatRelative(v, lang, prefs),
    }),
    [prefs, setPrefs, lang],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}
