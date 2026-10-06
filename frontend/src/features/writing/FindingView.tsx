import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getFinding } from '@/api/findings'
import { qk } from '@/api/queryKeys'
import { Button } from '@/components/Button'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { FindingForm } from './FindingForm'
import styles from './Writing.module.css'

interface Props {
  projectId: number
  /** A finding id, or 'new'. */
  id: number | 'new'
  canEdit: boolean
  onBack: () => void
  onCreated: (id: number) => void
  onOpenDocument: (id: number) => void
}

/** Loads one finding (or starts a new one) and hands it to the form, which is keyed by it so a different finding starts fresh. */
export function FindingView({ projectId, id, canEdit, onBack, onCreated, onOpenDocument }: Props) {
  const { t } = useTranslation()
  const finding = useQuery({
    queryKey: qk.project(projectId).findings.detail(id === 'new' ? 0 : id),
    queryFn: ({ signal }) => getFinding(projectId, id as number, signal),
    enabled: id !== 'new',
    retry: false,
  })

  if (id === 'new') {
    return canEdit ? (
      <FindingForm key="new" projectId={projectId} finding={null} canEdit onBack={onBack} onCreated={onCreated} onOpenDocument={onOpenDocument} />
    ) : (
      <p className={styles.hint}>{t('writing.finding.readOnly')}</p>
    )
  }

  return (
    <StateBoundary
      state={viewStateOf(finding)}
      errorValue={finding.error}
      onRetry={() => void finding.refetch()}
      forbidden={
        <div className={styles.notice} role="status">
          <h1>{t('writing.unavailable.title')}</h1>
          <p>{t('writing.unavailable.body')}</p>
          <Button onClick={onBack}>{t('writing.back')}</Button>
        </div>
      }
    >
      {finding.data ? (
        <FindingForm
          key={finding.data.id}
          projectId={projectId}
          finding={finding.data}
          canEdit={canEdit}
          onBack={onBack}
          onCreated={onCreated}
          onOpenDocument={onOpenDocument}
        />
      ) : null}
    </StateBoundary>
  )
}
