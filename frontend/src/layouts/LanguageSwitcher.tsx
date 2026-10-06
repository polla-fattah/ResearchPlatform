import { useTranslation } from 'react-i18next'
import { setLanguage } from '@/i18n'
import { isLanguage, LANGUAGE_CODES, LANGUAGES, type LanguageCode } from '@/i18n/languages'

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const current: LanguageCode = isLanguage(i18n.language) ? i18n.language : 'en'
  return (
    <label>
      <span className="visually-hidden">{t('common.language')}</span>
      <select value={current} onChange={(e) => void setLanguage(e.target.value as LanguageCode)}>
        {LANGUAGE_CODES.map((code) => (
          <option key={code} value={code}>
            {LANGUAGES[code].native}
          </option>
        ))}
      </select>
    </label>
  )
}
