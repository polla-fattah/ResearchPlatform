import { useTranslation } from 'react-i18next'
import { NeutralState } from '@/components/Badges'
import { BidiText } from '@/components/BidiText'
import { Field } from '@/components/Field'
import {
  citationPreview,
  EXTERNAL_KINDS,
  missingParts,
  type ExternalReferenceForm,
} from '@/domain/externalReference'
import styles from './Picker.module.css'

interface Props {
  value: ExternalReferenceForm
  onChange: (next: ExternalReferenceForm) => void
  disabled?: boolean
}

/** Screen 07, "External reference". Incomplete citations are allowed and visibly flagged (LIB-03). */
export function ExternalForm({ value, onChange, disabled }: Props) {
  const { t } = useTranslation()
  const set = <K extends keyof ExternalReferenceForm>(k: K, v: ExternalReferenceForm[K]) =>
    onChange({ ...value, [k]: v })
  const missing = missingParts(value)

  return (
    <div className={styles.form}>
      <p style={{ margin: 0 }}>{t('picker.external.lead')}</p>

      <Field label={t('picker.external.kind')}>
        <select
          value={value.kind}
          disabled={disabled}
          onChange={(e) => set('kind', e.target.value as ExternalReferenceForm['kind'])}
        >
          {EXTERNAL_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`picker.external.kinds.${k}`)}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t('picker.external.titleField')} requirement="required">
        <input
          value={value.title}
          disabled={disabled}
          dir="auto"
          onChange={(e) => set('title', e.target.value)}
        />
      </Field>

      <Field label={t('picker.external.author')} requirement="optional">
        <input
          value={value.author}
          disabled={disabled}
          dir="auto"
          onChange={(e) => set('author', e.target.value)}
        />
      </Field>

      <div className={styles.row}>
        <Field label={t('picker.external.date')} requirement="optional">
          <input
            value={value.dateUnknown ? '' : value.date}
            disabled={disabled || value.dateUnknown}
            onChange={(e) => set('date', e.target.value)}
          />
        </Field>
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={value.dateUnknown}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, dateUnknown: e.target.checked, date: '' })}
          />
          {t('picker.external.dateUnknown')}
        </label>
        <Field label={t('picker.external.accessed')} hint={t('picker.external.accessedHint')}>
          <input
            type="date"
            value={value.accessed}
            disabled={disabled}
            onChange={(e) => set('accessed', e.target.value)}
          />
        </Field>
      </div>

      <Field label={t('picker.external.url')} requirement="optional">
        <input value={value.url} disabled={disabled} dir="ltr" onChange={(e) => set('url', e.target.value)} />
      </Field>
      <div className={styles.row}>
        <Field label={t('picker.external.identifier')} requirement="optional">
          <input value={value.identifier} disabled={disabled} dir="ltr" onChange={(e) => set('identifier', e.target.value)} />
        </Field>
        <Field label={t('picker.external.venue')} requirement="optional">
          <input value={value.venue} disabled={disabled} dir="auto" onChange={(e) => set('venue', e.target.value)} />
        </Field>
        <Field label={t('picker.external.pages')} requirement="optional">
          <input value={value.pages} disabled={disabled} onChange={(e) => set('pages', e.target.value)} />
        </Field>
      </div>

      <div>
        <strong>{t('picker.external.preview')}</strong>
        <BidiText as="p" className={styles.cite}>
          {citationPreview(value)}
        </BidiText>
        {missing.length > 0 ? (
          <p>
            <NeutralState kind="incompleteCitation" />{' '}
            {t('picker.external.missing', { list: missing.join(', ') })}
          </p>
        ) : (
          <p className={styles.hint}>{t('picker.external.complete')}</p>
        )}
      </div>
    </div>
  )
}
