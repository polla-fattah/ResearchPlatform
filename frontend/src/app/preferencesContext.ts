import { createContext, useContext } from 'react'
import type { DisplayPreferences } from '@/i18n/format'

export interface PreferencesValue {
  prefs: DisplayPreferences
  setPrefs: (next: Partial<DisplayPreferences>) => void
  /** Numbers follow the numerals preference (Eastern Arabic or Western). */
  n: (value: number) => number | string
  date: (value: Date | string, opts?: { time?: boolean; weekday?: boolean }) => string
  /** "2 hours ago" style, switching to a date after a week. */
  relative: (value: Date | string) => string
}

export const PreferencesContext = createContext<PreferencesValue | null>(null)

export function usePreferences(): PreferencesValue {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used inside <PreferencesProvider>')
  return ctx
}
