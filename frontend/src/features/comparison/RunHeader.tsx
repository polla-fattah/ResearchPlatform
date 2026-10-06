import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { AnalysisRun } from '@/api/schemas/analyses'
import { invalidate } from '@/api/invalidate'
import { usePreferences } from '@/app/preferencesContext'
import { Button } from '@/components/Button'
import { formatCode } from '@/domain/codes'
import { MutationNotice } from '@/components/MutationNotice'
import { analysisCode, inputsOf, narratorCode, reportCode } from './comparisonModel'
import { storeComparison } from './storeComparison'
import styles from './Comparison.module.css'

interface Props {
  run: AnalysisRun
  projectId: number
  canEdit: boolean
  onOpenInWorkspace: (inputs: NonNullable<ReturnType<typeof inputsOf>>) => void
  /** Called with the stored result of running it again. */
  onRunAgain: (runId: number) => void
}

/** What a stored analysis is, who stored it and from what, and the two things that can be done with it. */
export function RunHeader({ run, projectId, canEdit, onOpenInWorkspace, onRunAgain }: Props) {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const qc = useQueryClient()
  const inputs = inputsOf(run)

  const again = useMutation({
    mutationFn: () => storeComparison(projectId, inputs!),
    onSuccess: async (result) => {
      await invalidate.analysesChanged(qc, projectId)
      if (result.saved) onRunAgain(result.saved.id)
    },
  })

  const listed =
    inputs?.kind === 'matn'
      ? inputs.hadithIds.map(reportCode)
      : inputs?.kind === 'criticism'
        ? inputs.narratorIds.map(narratorCode)
        : inputs?.kind === 'isnads'
          ? inputs.sanadIds.map((id) => formatCode('CH', id))
          : []
  // A matn comparison opens in the workspace from its reports, a criticism matrix from its narrators; chains are made from sanad ids the workspace derives itself.
  const canOpen = inputs?.kind === 'matn' || inputs?.kind === 'criticism'

  return (
    <div>
      <p className={styles.hint}>
        <span className={styles.code}>{analysisCode(run.id)}</span> ·{' '}
        {t('comparison.run.meta', { author: run.creator?.display_name ?? '—', when: run.created_at ? date(run.created_at, { time: true }) : '—' })}
      </p>
      <p className={styles.hint}>
        {inputs ? t('comparison.run.inputs', { list: listed.join(', ') }) : t('comparison.run.inputsUnreadable')}
      </p>
      <p className={styles.hint}>{t('comparison.run.corpusNote')}</p>
      <div className={styles.barActions}>
        {inputs && canOpen ? <Button onClick={() => onOpenInWorkspace(inputs)}>{t('comparison.run.openInputs')}</Button> : null}
        {inputs && canEdit ? (
          <Button variant="primary" disabled={again.isPending} onClick={() => again.mutate()}>
            {again.isPending ? t('comparison.bar.saving') : t('comparison.run.again', { version: run.version_number + 1 })}
          </Button>
        ) : null}
      </div>
      {inputs && canEdit ? <p className={styles.hint}>{t('comparison.run.againNote')}</p> : null}
      <MutationNotice error={again.error} title={t('comparison.run.againFailed')} />
    </div>
  )
}
