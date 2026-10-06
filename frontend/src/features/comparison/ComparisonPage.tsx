import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePreferences } from '@/app/preferencesContext'
import { Button } from '@/components/Button'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { useQueryParams } from '@/hooks/useQueryParams'
import { useProject } from '@/features/projects/useProject'
import { ChainsView } from './ChainsView'
import { analysisCode, idsParam, MAX_NARRATORS, MAX_REPORTS, parseIds, runTitle, VIEWS, type View } from './comparisonModel'
import { CriticismView } from './CriticismView'
import { DossierView } from './DossierView'
import { OccurrencesView } from './OccurrencesView'
import { RunHeader } from './RunHeader'
import { SelectReportsDialog } from './SelectReportsDialog'
import { StoredRunView } from './StoredRunView'
import { useRun, useRuns } from './useComparison'
import styles from './Comparison.module.css'

/**
 * Screen 10. The address holds everything that defines what is on screen, so Back, a reload and a pasted link land on
 * the same comparison:  ?view=occ|chains|dossier|crit  &h=<report ids>  &base=<baseline report>  &narrator=<id>  &n=<ids>
 * and  ?run=<id>  for a stored analysis. The only local state is the dialog that chooses the reports.
 */
export function ComparisonPage() {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const { id: projectId, can } = useProject()
  const url = useQueryParams()
  const [selecting, setSelecting] = useState(false)

  const pid = projectId ?? 0
  const canEdit = can('addShared')
  const runId = url.id('run')
  const view = url.oneOf('view', VIEWS, 'occ')
  const reportIds = parseIds(url.text('h'), MAX_REPORTS)
  const narratorIds = parseIds(url.text('n'), MAX_NARRATORS)

  const runs = useRuns(pid)
  const run = useRun(pid, runId)

  if (projectId === null) return null

  const go = (changes: Record<string, string | number | null>) => url.set(changes, { push: true, keepPage: true })
  const openDossier = (id: number) => go({ run: null, view: 'dossier', narrator: id })

  return (
    <section aria-label={t('comparison.title')}>
      <div className={styles.bar}>
        <div className={styles.barText}>
          <h1>{run.data ? runTitle(t, run.data) : t('comparison.bar.untitled')}</h1>
          {run.data ? (
            <RunHeader
              run={run.data}
              projectId={projectId}
              canEdit={canEdit}
              onOpenInWorkspace={(inputs) =>
                url.replaceAll(
                  inputs.kind === 'matn' ? { view: 'occ', h: idsParam(inputs.hadithIds) } : { view: 'crit', n: idsParam(inputs.kind === 'criticism' ? inputs.narratorIds : []) },
                  { push: true },
                )
              }
              onRunAgain={(newId) => url.replaceAll({ run: newId }, { push: true })}
            />
          ) : (
            <p className={styles.hint}>
              {view === 'dossier'
                ? t('comparison.bar.dossierNote')
                : reportIds.length > 0 || narratorIds.length > 0
                  ? t('comparison.bar.notSaved')
                  : t('comparison.bar.metaNone')}
            </p>
          )}
        </div>

        <div className={styles.barActions}>
          <select
            className={styles.picker}
            aria-label={t('comparison.bar.open')}
            value={runId ?? ''}
            disabled={!runs.data || runs.data.length === 0}
            onChange={(e) => go({ run: e.target.value || null })}
          >
            <option value="">{t('comparison.bar.openPrompt', { count: runs.data?.length ?? 0 })}</option>
            {(runs.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {analysisCode(r.id)} · {runTitle(t, r)}
                {r.created_at ? ` · ${date(r.created_at)}` : ''}
              </option>
            ))}
          </select>
          {run.data ? (
            <Button onClick={() => go({ run: null })}>{t('comparison.bar.close')}</Button>
          ) : view === 'occ' || view === 'chains' ? (
            <Button variant="primary" onClick={() => setSelecting(true)}>
              {t('comparison.bar.select')}
            </Button>
          ) : null}
        </div>
      </div>

      {runId !== undefined ? (
        <StateBoundary
          state={viewStateOf(run)}
          errorValue={run.error}
          onRetry={() => void run.refetch()}
          forbidden={
            <div className={styles.notice} role="status">
              <h2>{t('comparison.run.unavailable.title')}</h2>
              <p>{t('comparison.run.unavailable.body')}</p>
              <Button onClick={() => go({ run: null })}>{t('comparison.run.unavailable.action')}</Button>
            </div>
          }
        >
          {run.data ? <StoredRunView run={run.data} onOpenDossier={openDossier} /> : null}
        </StateBoundary>
      ) : (
        <>
          <div role="tablist" aria-label={t('comparison.views.label')} className={styles.tabs}>
            {VIEWS.map((v: View) => (
              <button key={v} type="button" role="tab" className={styles.tab} aria-selected={view === v} onClick={() => go({ view: v })}>
                {t(`comparison.views.${v}`)}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {view === 'occ' ? (
              <OccurrencesView
                projectId={projectId}
                reportIds={reportIds}
                baseline={url.id('base')}
                canEdit={canEdit}
                onBaseline={(id) => url.set({ base: id })}
                onSelect={() => setSelecting(true)}
              />
            ) : null}
            {view === 'chains' ? (
              <ChainsView projectId={projectId} reportIds={reportIds} canEdit={canEdit} onSelect={() => setSelecting(true)} onOpenDossier={openDossier} />
            ) : null}
            {view === 'dossier' ? (
              <DossierView
                projectId={projectId}
                narratorId={url.id('narrator')}
                reportIds={reportIds}
                onPick={(id) => url.set({ narrator: id })}
                onCompareCriticism={(id) => go({ view: 'crit', n: idsParam([id]) })}
              />
            ) : null}
            {view === 'crit' ? (
              <CriticismView projectId={projectId} narratorIds={narratorIds} canEdit={canEdit} onChange={(ids) => url.set({ n: idsParam(ids) })} />
            ) : null}
          </div>
        </>
      )}

      {selecting ? (
        <SelectReportsDialog
          projectId={projectId}
          initial={reportIds}
          onClose={() => setSelecting(false)}
          onApply={(ids) => {
            const base = url.id('base')
            url.set({ h: idsParam(ids), base: base !== undefined && ids.includes(base) ? base : null })
            setSelecting(false)
          }}
        />
      ) : null}
    </section>
  )
}
