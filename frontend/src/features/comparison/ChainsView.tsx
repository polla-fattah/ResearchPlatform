import { useTranslation } from 'react-i18next'
import { usePreferences } from '@/app/preferencesContext'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { ChainColumns } from './ChainColumns'
import { reportCode } from './comparisonModel'
import { SaveAnalysis } from './SaveAnalysis'
import { useChainsOfReports } from './useComparison'
import { ViewEmpty } from './ViewEmpty'
import styles from './Comparison.module.css'

interface Props {
  projectId: number
  reportIds: number[]
  canEdit: boolean
  onSelect: () => void
  onOpenDossier: (narratorId: number) => void
}

/** Screen 10, Chains: the chains of the picked reports side by side. */
export function ChainsView({ projectId, reportIds, canEdit, onSelect, onOpenDossier }: Props) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const { loaded, sources, shown, compare } = useChainsOfReports(projectId, reportIds)

  if (reportIds.length === 0) return <ViewEmpty view="chains" canSelect onSelect={onSelect} />

  const state = loaded.pending ? 'loading' : loaded.failed ? 'error' : shown.length < 2 ? 'empty' : viewStateOf(compare)
  const sourceOf = (sanadId: number) => sources.find((s) => s.sanadId === sanadId)

  return (
    <section aria-label={t('comparison.views.chains')}>
      {loaded.missing.map((id) => (
        <p key={id} className={styles.notice} role="note">
          {t('comparison.occ.missing', { code: reportCode(id) })}
        </p>
      ))}
      {sources.length > shown.length ? (
        <p className={styles.notice} role="note">
          {t('comparison.chains.tooMany', {
            shown: n(shown.length),
            total: n(sources.length),
          })}
        </p>
      ) : null}
      <StateBoundary
        state={state}
        errorValue={compare.error}
        onRetry={() => void compare.refetch()}
        empty={
          <div className={styles.empty}>
            <h2>{t('comparison.chains.needTwo.title')}</h2>
            <p>{t('comparison.chains.needTwo.body', { count: sources.length, formattedCount: n(sources.length) })}</p>
          </div>
        }
      >
        {compare.data ? (
          <>
            {canEdit ? (
              <SaveAnalysis
                projectId={projectId}
                inputs={{
                  kind: 'isnads',
                  sanadIds: shown.map((s) => s.sanadId),
                }}
              />
            ) : null}
            <ChainColumns
              result={compare.data}
              onOpenDossier={onOpenDossier}
              describe={(chain) => {
                const src = sourceOf(chain.sanad_id)
                if (!src) return reportCode(chain.sanad_id)
                return `${src.book || reportCode(src.reportId)}${src.number !== null ? ` · ${src.number}` : ''}`
              }}
            />
          </>
        ) : null}
      </StateBoundary>
    </section>
  )
}
