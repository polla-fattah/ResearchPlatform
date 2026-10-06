import { useTranslation } from 'react-i18next'
import type { VariantAlignment } from '@/api/schemas/alignment'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { kindOf, summaryOf, visibleSlots, type Kind } from './alignmentModel'
import styles from './Alignment.module.css'

const SYMBOL: Record<Kind, string> = { same: '=', different: '~', added: '+', omitted: '∅', unknown: '?' }

interface Props {
  baselineLabel: string
  variant: VariantAlignment
  label: string
  onlyDifferences: boolean
}

/**
 * One text aligned against the baseline, slot by slot. Each difference carries its kind in words and a symbol (never
 * colour alone). The words are the server's normalised tokens (diacritics removed, letter forms unified), which is
 * what it aligned; the printed wording is shown above the table.
 */
export function AlignmentTable({ baselineLabel, variant, label, onlyDifferences }: Props) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const slots = variant.collation.operations
  const { counts, percent } = summaryOf(variant.collation)
  const rows = visibleSlots(slots, onlyDifferences)
  const differences = counts.different + counts.added + counts.omitted

  return (
    <section className={styles.variant} aria-label={label}>
      <h2>
        <BidiText>{label}</BidiText>
      </h2>
      <ul className={styles.summary} aria-label={t('alignment.summary.label')}>
        <li>{t('alignment.summary.same', { count: counts.same, formattedCount: n(counts.same) })}</li>
        <li>{t('alignment.summary.different', { count: counts.different, formattedCount: n(counts.different) })}</li>
        <li>{t('alignment.summary.added', { count: counts.added, formattedCount: n(counts.added) })}</li>
        <li>{t('alignment.summary.omitted', { count: counts.omitted, formattedCount: n(counts.omitted) })}</li>
        {percent !== null ? <li>{t('alignment.summary.percent', { percent: n(percent) })}</li> : null}
      </ul>
      {slots.length === 0 ? (
        <p className={styles.note}>{t('alignment.nothingAligned')}</p>
      ) : differences === 0 && onlyDifferences ? (
        <p className={styles.note}>{t('alignment.identical')}</p>
      ) : (
        <table className={styles.table} aria-label={t('alignment.table.label', { label })}>
          <thead>
            <tr>
              <th scope="col">{t('alignment.table.position')}</th>
              <th scope="col">{baselineLabel}</th>
              <th scope="col">{label}</th>
              <th scope="col">{t('alignment.table.difference')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ index, slot }) => {
              const kind = kindOf(slot)
              return (
                <tr key={index} className={kind === 'same' ? styles.same : styles.diff}>
                  <td>{n(index + 1)}</td>
                  <td>{slot.token_a ? <BidiText>{slot.token_a}</BidiText> : <span className={styles.gap}>{t('alignment.table.none')}</span>}</td>
                  <td>{slot.token_b ? <BidiText>{slot.token_b}</BidiText> : <span className={styles.gap}>{t('alignment.table.none')}</span>}</td>
                  <td className={styles.kind}>
                    <span aria-hidden="true">{SYMBOL[kind]}</span> {t(`alignment.kinds.${kind}`)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}
