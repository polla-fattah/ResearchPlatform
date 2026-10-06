import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { criticismMatrixResultSchema, isnadCompareResultSchema, matnCompareResultSchema, parseStored, type AnalysisRun } from '@/api/schemas/analyses'
import { usePreferences } from '@/app/preferencesContext'
import { StoredValue } from '@/components/StoredValue'
import { ChainColumns } from './ChainColumns'
import { CriticismMatrixTable } from './CriticismMatrixTable'
import { reportCode } from './comparisonModel'
import { MatnColumns } from './MatnColumns'
import styles from './Comparison.module.css'

interface Props {
  run: AnalysisRun
  onOpenDossier: (narratorId: number) => void
}

/**
 * A stored analysis. When its result has the shape the server makes it is drawn like the live view; when it has any
 * other shape (the demo's hand-written runs, or a kind this screen does not compare) it is shown as stored, labelled
 * so, with no conclusion added (request file C-19).
 */
export function StoredRunView({ run, onOpenDossier }: Props) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const [highlight, setHighlight] = useState(true)

  const matn = run.analysis_type === 'matn_comparison' ? parseStored(matnCompareResultSchema, run.output_data) : null
  const chains = run.analysis_type === 'isnad_comparison' ? parseStored(isnadCompareResultSchema, run.output_data) : null
  const criticism = run.analysis_type === 'criticism_matrix' ? parseStored(criticismMatrixResultSchema, run.output_data) : null

  if (matn) {
    return (
      <section aria-label={t('comparison.views.occ')}>
        <div className={styles.toolbar}>
          <p>{t('comparison.occ.summaryLine', { count: matn.variant_count, formattedCount: n(matn.variant_count) })}</p>
          <label className={styles.toggle}>
            <input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} />
            {t('comparison.occ.highlight')}
          </label>
        </div>
        <MatnColumns
          result={matn}
          highlight={highlight}
          describe={(v) => ({ title: v.label ?? (typeof v.id === 'number' ? reportCode(v.id) : String(v.id)) })}
        />
      </section>
    )
  }
  if (chains) return <ChainColumns result={chains} onOpenDossier={onOpenDossier} />
  if (criticism) return <CriticismMatrixTable result={criticism} />

  return (
    <section aria-label={t('comparison.stored.title')}>
      <div className={styles.notice} role="note">
        <h2>{t('comparison.stored.title')}</h2>
        <p>{t('comparison.stored.body')}</p>
      </div>
      <h3>{t('comparison.stored.result')}</h3>
      <StoredValue value={run.output_data} />
      <h3>{t('comparison.stored.inputs')}</h3>
      <StoredValue value={run.input_params} />
    </section>
  )
}
