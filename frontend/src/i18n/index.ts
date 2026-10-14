import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import { DEFAULT_LANGUAGE, directionOf, isLanguage, type LanguageCode } from './languages'

const STORAGE_KEY = 'oh.lang'

/**
 * English is always in the bundle (it is the fallback for every missing string). Sorani and Arabic are fetched only when
 * a person uses them, so a visitor who reads English does not download them.
 */
const LOADERS: Partial<Record<LanguageCode, () => Promise<{ default: Record<string, unknown> }>>> = {
  ckb: () => import('./locales/ckb.json'),
  ar: () => import('./locales/ar.json'),
}

/** Makes sure the strings of a language are in memory. Resolves at once for English and for a language already loaded. */
export async function loadLanguage(lang: LanguageCode): Promise<void> {
  const load = LOADERS[lang]
  if (!load || i18n.hasResourceBundle(lang, 'translation')) return
  const bundle = await load()
  i18n.addResourceBundle(lang, 'translation', bundle.default, true, true)
}

export function storedLanguage(): LanguageCode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (isLanguage(v)) return v
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_LANGUAGE
}

/** Keeps <html lang> and <html dir> in step with the UI language (whole interface flips to RTL). */
export function applyDocumentLanguage(lang: LanguageCode, root: HTMLElement = document.documentElement) {
  root.lang = lang
  root.dir = directionOf(lang)
}

export async function setLanguage(lang: LanguageCode) {
  await loadLanguage(lang)
  await i18n.changeLanguage(lang)
  applyDocumentLanguage(lang)
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    /* storage unavailable */
  }
}

export function initI18n(lang: LanguageCode = storedLanguage()) {
  void i18n.use(initReactI18next).init({
    // ckb is a first full draft (machine-assisted, 7 Oct 2026) that still needs a native speaker's review against
    // docs/design/terminology.md. ar is partly filled. Missing keys fall back to English.
    resources: { en: { translation: en } },
    lng: lang,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  })
  applyDocumentLanguage(lang)
  // A stored language other than English shows English for a moment, then switches when its strings have arrived.
  if (lang !== 'en') void loadLanguage(lang).then(() => i18n.changeLanguage(lang))
  return i18n
}

export default i18n
