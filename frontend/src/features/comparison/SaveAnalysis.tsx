import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { invalidate } from '@/api/invalidate'
import { Button } from '@/components/Button'
import { MutationNotice } from '@/components/MutationNotice'
import { analysisCode, type RunInputs } from './comparisonModel'
import { storeComparison } from './storeComparison'
import styles from './Comparison.module.css'

interface Props {
  projectId: number
  /** What the comparison on screen was made from; null when there is nothing to store yet. */
  inputs: RunInputs | null
  baseline?: number
}

/** "Save analysis": stores the comparison on screen as a new version, and offers to open what was stored. */
export function SaveAnalysis({ projectId, inputs, baseline }: Props) {
  const { t } = useTranslation()
  const qc = useQueryClient()

  const save = useMutation({
    mutationFn: () => storeComparison(projectId, inputs!, baseline),
    onSuccess: () => invalidate.analysesChanged(qc, projectId),
  })
  const stored = save.data?.saved ?? null

  return (
    <div>
      <Button variant="primary" disabled={!inputs || save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? t('comparison.bar.saving') : t('comparison.bar.save')}
      </Button>
      <MutationNotice error={save.error} title={t('comparison.bar.saveFailed')} />
      {stored ? (
        <p className={styles.success} role="status">
          {t('comparison.bar.saved', {
            title: t('comparison.run.title', {
              kind: t(`comparison.run.types.${stored.analysis_type}`, {
                defaultValue: stored.analysis_type,
              }),
              version: stored.version_number,
            }),
            code: analysisCode(stored.id),
          })}{' '}
          <Link to={{ search: `?run=${stored.id}` }}>{t('comparison.bar.openSaved')}</Link>
        </p>
      ) : null}
    </div>
  )
}
