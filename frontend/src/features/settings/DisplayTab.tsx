import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { saveProfile } from '@/api/account'
import { invalidate } from '@/api/invalidate'
import { CALENDARS, NUMERALS } from '@/api/schemas/account'
import { usePreferences } from '@/app/preferencesContext'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { MutationNotice } from '@/components/MutationNotice'
import { useNow } from '@/hooks/useNow'
import { setLanguage } from '@/i18n'
import { formatDate, formatNumber, type DisplayPreferences } from '@/i18n/format'
import { isLanguage, LANGUAGE_CODES, LANGUAGES, type LanguageCode } from '@/i18n/languages'
import { timeZoneChoices } from './settingsModel'
import styles from './Settings.module.css'

/** Language and display: the interface language, the language new text starts in, numerals, calendar and time zone. */
export function DisplayTab() {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const { prefs } = usePreferences()
  const now = useNow()

  const uiLanguage: LanguageCode = isLanguage(i18n.language) ? i18n.language : 'en'
  const [language, setLanguageDraft] = useState<LanguageCode>(uiLanguage)
  const [draft, setDraft] = useState<DisplayPreferences>(prefs)
  const changed = language !== uiLanguage || draft.contentLanguage !== prefs.contentLanguage || draft.numerals !== prefs.numerals || draft.calendar !== prefs.calendar || draft.timeZone !== prefs.timeZone

  const save = useMutation({
    mutationFn: () =>
      saveProfile({
        preferred_language: language,
        display_preferences: {
          default_content_language: draft.contentLanguage,
          numerals: draft.numerals,
          calendar: draft.calendar,
          time_zone: draft.timeZone,
        },
      }),
    onSuccess: async () => {
      await setLanguage(language)
      await invalidate.me(qc)
    },
  })

  const zones = timeZoneChoices(draft.timeZone, Intl.DateTimeFormat().resolvedOptions().timeZone)
  const set = <K extends keyof DisplayPreferences>(key: K, value: DisplayPreferences[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const example = new Date(now)

  return (
    <form
      className={styles.form}
      aria-label={t('settings.tabs.display')}
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate()
      }}
    >
      <Field label={t('settings.display.interface')} hint={t('settings.display.interfaceHint')}>
        <select value={language} onChange={(e) => setLanguageDraft(e.target.value as LanguageCode)}>
          {LANGUAGE_CODES.map((code) => (
            <option key={code} value={code}>
              {LANGUAGES[code].native}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('settings.display.content')} hint={t('settings.display.contentHint')}>
        <select value={draft.contentLanguage} onChange={(e) => set('contentLanguage', e.target.value as LanguageCode)}>
          {LANGUAGE_CODES.map((code) => (
            <option key={code} value={code}>
              {t(`registration.languages.${code}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('settings.display.numerals')} hint={t('settings.display.numeralsHint')}>
        <select value={draft.numerals} onChange={(e) => set('numerals', e.target.value as DisplayPreferences['numerals'])}>
          {NUMERALS.map((n) => (
            <option key={n} value={n}>
              {t(`settings.display.numeralChoices.${n}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('settings.display.calendar')} hint={t('settings.display.calendarHint')}>
        <select value={draft.calendar} onChange={(e) => set('calendar', e.target.value as DisplayPreferences['calendar'])}>
          {CALENDARS.map((c) => (
            <option key={c} value={c}>
              {t(`settings.display.calendarChoices.${c}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('settings.display.timeZone')} hint={t('settings.display.timeZoneHint')}>
        <select value={draft.timeZone} onChange={(e) => set('timeZone', e.target.value)}>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
      </Field>

      <section className={styles.preview} aria-label={t('settings.display.preview')}>
        <h3>{t('settings.display.preview')}</h3>
        <dl className={styles.facts}>
          <dt>{t('settings.display.previewDate')}</dt>
          <dd>{formatDate(example, language, draft, { time: true })}</dd>
          <dt>{t('settings.display.previewNumber')}</dt>
          <dd>{String(formatNumber(1234567, language, draft))}</dd>
        </dl>
        <p className={styles.hint}>{t('settings.display.sourceDates')}</p>
      </section>

      <MutationNotice error={save.error} title={t('settings.saveFailed')} />
      <div className={styles.saveBar}>
        <Button type="submit" variant="primary" disabled={save.isPending || !changed}>
          {save.isPending ? t('settings.saving') : t('settings.save')}
        </Button>
        <span role="status" className={styles.hint}>
          {save.isPending ? '' : changed ? t('settings.unsaved') : save.isSuccess ? t('settings.saved') : ''}
        </span>
      </div>
    </form>
  )
}
