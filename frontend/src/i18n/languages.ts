export const LANGUAGES = {
  en: { label: 'English', native: 'English', dir: 'ltr' },
  ckb: { label: 'Sorani', native: 'کوردی', dir: 'rtl' },
  ar: { label: 'Arabic', native: 'العربية', dir: 'rtl' },
} as const

export type LanguageCode = keyof typeof LANGUAGES
export const LANGUAGE_CODES = Object.keys(LANGUAGES) as LanguageCode[]
export const DEFAULT_LANGUAGE: LanguageCode = 'en'

export function isLanguage(v: unknown): v is LanguageCode {
  return typeof v === 'string' && v in LANGUAGES
}

export function directionOf(lang: LanguageCode): 'ltr' | 'rtl' {
  return LANGUAGES[lang].dir
}
