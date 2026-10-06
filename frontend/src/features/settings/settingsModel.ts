import { PUBLIC_FIELDS, type PublicField } from '@/api/schemas/account'

export const SETTINGS_TABS = ['profile', 'display', 'security', 'support', 'notifications', 'account'] as const
export type SettingsTab = (typeof SETTINGS_TABS)[number]

/** "Takhrīj, Narrator criticism" → ['Takhrīj', 'Narrator criticism']: split on commas (Latin and Arabic) and new lines. */
export function parseInterests(text: string): string[] {
  const seen = new Set<string>()
  for (const part of text.split(/[,،\n]/)) {
    const item = part.trim()
    if (item) seen.add(item)
  }
  return [...seen]
}

export const interestsText = (list: readonly string[] | null | undefined): string => (list ?? []).join(', ')

/**
 * The fields the profile makes public, whichever way the server stored them: a list of names (what the public page
 * reads) or a map of booleans (what the demo data has, request file C-10). Nothing stored means the server's own
 * default, which is every field except the email.
 */
export function publicFieldsOf(stored: readonly string[] | Record<string, unknown> | null | undefined): PublicField[] {
  if (stored === null || stored === undefined) return PUBLIC_FIELDS.filter((f) => f !== 'email')
  const names = Array.isArray(stored) ? (stored as string[]) : Object.keys(stored).filter((k) => (stored as Record<string, unknown>)[k])
  return PUBLIC_FIELDS.filter((f) => names.includes(f))
}

/** A secret in groups of four, so it can be read out and typed into an authenticator app. */
export const groupSecret = (secret: string): string => (secret.match(/.{1,4}/g) ?? []).join(' ')

/** The strongest check the server makes of a new password (`min:8`, confirmed). */
export const MIN_PASSWORD = 8

/** A time zone name the browser understands. */
export function isTimeZone(name: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: name })
    return true
  } catch {
    return false
  }
}

/** The zones offered, with the one in use (and the browser's own) always present. */
export function timeZoneChoices(current: string, browser: string): string[] {
  const base = ['UTC', 'Asia/Baghdad', 'Asia/Riyadh', 'Asia/Dubai', 'Africa/Cairo', 'Europe/Istanbul', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles']
  return [...new Set([current, browser, ...base])].filter(isTimeZone)
}
