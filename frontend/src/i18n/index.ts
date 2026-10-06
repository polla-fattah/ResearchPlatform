import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ar from './locales/ar.json'
import ckb from './locales/ckb.json'
import en from './locales/en.json'
import { DEFAULT_LANGUAGE, directionOf, isLanguage, type LanguageCode } from './languages'

const STORAGE_KEY = 'oh.lang'

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
    resources: {
      en: { translation: en },
      // ckb and ar are filled after specialist review of docs/design/terminology.md;
      // missing keys fall back to English.
      ckb: { translation: ckb },
      ar: { translation: ar },
    },
    lng: lang,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  })
  applyDocumentLanguage(lang)
  return i18n
}

export default i18n
