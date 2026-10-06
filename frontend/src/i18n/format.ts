import type { LanguageCode } from './languages'

/** Display preferences from screen 14 (Language & display). */
export interface DisplayPreferences {
  numerals: 'eastern_arabic' | 'western'
  calendar: 'gregorian_hijri' | 'hijri_gregorian' | 'gregorian'
  timeZone: string
  /** The language new notes and blocks start in. Saved with the account; display code does not use it. */
  contentLanguage: LanguageCode
}

export const DEFAULT_PREFERENCES: DisplayPreferences = {
  numerals: 'western',
  calendar: 'gregorian_hijri',
  timeZone: 'UTC',
  contentLanguage: 'ar',
}

function locale(lang: LanguageCode, prefs: DisplayPreferences, calendar?: 'gregory' | 'islamic-umalqura') {
  const nu = prefs.numerals === 'eastern_arabic' ? 'arab' : 'latn'
  const ca = calendar ? `-ca-${calendar}` : ''
  return `${lang}-u-nu-${nu}${ca}`
}

function safeFormatter(
  tags: string[],
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  // `ckb` may be missing from the runtime's ICU data; fall back to Arabic, then English.
  for (const tag of tags) {
    try {
      return new Intl.DateTimeFormat(tag, options)
    } catch {
      /* try next */
    }
  }
  return new Intl.DateTimeFormat('en', options)
}

export function formatNumber(n: number, lang: LanguageCode, prefs: DisplayPreferences): number | string {
  const tags = [locale(lang, prefs), locale('ar', prefs), locale('en', prefs)]
  for (const tag of tags) {
    try {
      return new Intl.NumberFormat(tag).format(n)
    } catch {
      /* try next */
    }
  }
  return n
}

/**
 * Gregorian and Hijri are both shown according to the user's preference.
 * A converted Hijri date is a conversion, not a recorded source date; callers label it as such.
 */
export function formatDate(
  value: Date | string,
  lang: LanguageCode,
  prefs: DisplayPreferences,
  opts: { time?: boolean; weekday?: boolean } = {},
): string {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''

  const base: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: prefs.timeZone,
    ...(opts.weekday ? { weekday: 'long' as const } : {}),
    ...(opts.time ? { hour: '2-digit', minute: '2-digit' } : {}),
  }
  const greg = safeFormatter(
    [locale(lang, prefs, 'gregory'), locale('ar', prefs, 'gregory'), 'en'],
    base,
  ).format(date)
  if (prefs.calendar === 'gregorian') return greg

  const hijri = safeFormatter(
    [locale(lang, prefs, 'islamic-umalqura'), locale('ar', prefs, 'islamic-umalqura')],
    { day: 'numeric', month: 'long', year: 'numeric', timeZone: prefs.timeZone },
  ).format(date)

  return prefs.calendar === 'hijri_gregorian' ? `${hijri} · ${greg}` : `${greg} · ${hijri}`
}

/**
 * "2 hours ago", "yesterday", then a plain date after a week. Falls back to the date when the
 * runtime has no relative-time data for the language.
 */
export function formatRelative(
  value: Date | string,
  lang: LanguageCode,
  prefs: DisplayPreferences,
  /** The time to measure from. The caller supplies it (the app clock), so this stays a pure function. */
  now: Date,
): string {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000)
  const abs = Math.abs(seconds)

  const pick = (): [number, Intl.RelativeTimeFormatUnit] | null => {
    if (abs < 60) return [seconds, 'second']
    if (abs < 3600) return [Math.round(seconds / 60), 'minute']
    if (abs < 86400) return [Math.round(seconds / 3600), 'hour']
    if (abs < 7 * 86400) return [Math.round(seconds / 86400), 'day']
    return null
  }
  const unit = pick()
  if (!unit) return formatDate(date, lang, prefs)
  for (const tag of [locale(lang, prefs), locale('ar', prefs), 'en']) {
    try {
      return new Intl.RelativeTimeFormat(tag, { numeric: 'auto' }).format(unit[0], unit[1])
    } catch {
      /* try next */
    }
  }
  return formatDate(date, lang, prefs)
}
