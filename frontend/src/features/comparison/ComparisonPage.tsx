import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { useProject } from '@/features/projects/useProject'
import { ChainsView } from './ChainsView'
import { OccurrencesView } from './OccurrencesView'
import { AnnotateModal, SelectInputsModal } from './ComparisonDialogs'
import {
  DEFAULT_CHAINS,
  DEFAULT_OCC_COLUMNS,
  type ComparisonViewMode,
  type OccurrenceColumn,
  type SavedAnalysisInfo,
} from './comparisonModel'
import { CriticismView } from './CriticismView'
import { DossierView } from './DossierView'
import styles from './Comparison.module.css'

export function ComparisonPage() {
  const { t } = useTranslation()
  const { id, can } = useProject()
  const projectId = id ?? 0
  const canEdit = can('editShared')

  const [params, setParams] = useSearchParams()
  const tabParam = (params.get('tab') as ComparisonViewMode) || 'occ'
  const stateParam = params.get('st') || 'normal'

  const [view, setView] = useState<ComparisonViewMode>(
    ['occ', 'chains', 'dossier', 'crit'].includes(tabParam) ? tabParam : 'occ',
  )
  const [st, setSt] = useState<string>(stateParam)
  const [diff, setDiff] = useState(true)

  // Modals state
  const [selectInputsOpen, setSelectInputsOpen] = useState(false)
  const [annotateOpen, setAnnotateOpen] = useState(false)
  const [annotateTargetCol, setAnnotateTargetCol] = useState<number | string>()

  // Columns & chains state
  const [occCols, setOccCols] = useState<OccurrenceColumn[]>(DEFAULT_OCC_COLUMNS)
  const [savedAnalysis, setSavedAnalysis] = useState<SavedAnalysisInfo>({
    name: 'Kufan chains side by side',
    id: 'AN-0003 · v2',
    meta: 'Inputs: OCC-ABD-000106, OCC-TIR-000044, OCC-NAS-000084 (corpus v2026.08) · settings: align by matn, show formulas · Shilan Rashid · saved 25 Sep 2026 14:10',
    version: 2,
    rerunLabel: 'Rerun as v3',
    changed: true,
  })
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const handleTabChange = (newView: ComparisonViewMode) => {
    setView(newView)
    const next = new URLSearchParams(params)
    next.set('tab', newView)
    setParams(next, { replace: true })
  }

  const handleStateChange = (newSt: string) => {
    setSt(newSt)
    const next = new URLSearchParams(params)
    next.set('st', newSt)
    setParams(next, { replace: true })
  }

  const handleRerun = () => {
    const nextVersion = savedAnalysis.version + 1
    setSavedAnalysis({
      ...savedAnalysis,
      id: `AN-0003 · v${nextVersion}`,
      version: nextVersion,
      rerunLabel: `Rerun as v${nextVersion + 1}`,
      changed: false,
    })
    setToastMessage(`Rerun completed as v${nextVersion}`)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleSaveAnalysis = () => {
    setSavedAnalysis({
      ...savedAnalysis,
      changed: false,
    })
    setToastMessage(t('comparison.bar.savedToast', { code: savedAnalysis.id }))
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleAnnotate = (colId: number | string) => {
    setAnnotateTargetCol(colId)
    setAnnotateOpen(true)
  }

  const handleSaveAnnotation = (noteText: string) => {
    if (!annotateTargetCol) return
    setOccCols((prev) =>
      prev.map((col) => {
        if (col.id === annotateTargetCol) {
          return {
            ...col,
            notes: [...col.notes, { vis: 'Project', text: noteText }],
          }
        }
        return col
      }),
    )
  }

  // Derive effective columns based on error state
  const effectiveOccCols = occCols.map((col) => {
    if (st === 'error' && col.id === 'occ-3') {
      return { ...col, limited: true, hasText: false }
    }
    return col
  })

  // Empty state copy per view
  const emptyTitle =
    view === 'occ'
      ? t('comparison.states.emptyOccTitle')
      : view === 'chains'
        ? t('comparison.states.emptyChainsTitle')
        : t('comparison.states.emptyCritTitle')

  const emptyBody =
    view === 'occ'
      ? t('comparison.states.emptyOccBody')
      : view === 'chains'
        ? t('comparison.states.emptyChainsBody')
        : t('comparison.states.emptyCritBody')

  return (
    <div className={styles.page}>
      {/* Review bar for development/testing */}
      <div data-screen-label="10 review bar" className={styles.reviewBar}>
        <div className={styles.reviewMeta}>
          <span className={styles.reviewTitle}>10 · {t('comparison.title')}</span>
          <span className={styles.reviewReqs}>{t('comparison.reqs')}</span>
          <span className={styles.reviewNotice}>{t('comparison.sampleNotice')}</span>
        </div>

        <div className={styles.chipsRow}>
          <span className={styles.chipsLabel}>View</span>
          {(['occ', 'chains', 'dossier', 'crit'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => handleTabChange(v)}
              className={[
                styles.chip,
                view === v ? styles.chipActive : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {t(`comparison.modes.${v}`)}
            </button>
          ))}
        </div>

        <div className={styles.chipsRow}>
          <span className={styles.chipsLabel}>State</span>
          {['normal', 'empty', 'loading', 'error', 'forbidden'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleStateChange(s)}
              className={[
                styles.chip,
                st === s ? styles.chipStateActive : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {st === 'forbidden' ? (
        <div className={styles.stateContainer}>
          <div className={styles.forbiddenCard}>
            <h1 className={styles.forbiddenTitle}>{t('comparison.states.forbiddenTitle')}</h1>
            <p className={styles.forbiddenText}>{t('comparison.states.forbiddenBody')}</p>
            <Link
              to={`/projects/${projectId}/analysis`}
              onClick={() => setSt('normal')}
              className={styles.chip}
              style={{
                alignSelf: 'flex-start',
                background: 'var(--surface-white)',
                color: 'var(--ink)',
                border: '1px solid var(--rule-strong)',
                textDecoration: 'none',
              }}
            >
              {t('comparison.states.seeAnalyses')}
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Saved analysis bar */}
          <div role="region" aria-label="Saved analysis" className={styles.analysisBar}>
            <div className={styles.analysisMeta}>
              <div className={styles.analysisTitleRow}>
                <span className={styles.analysisTitle}>
                  {st === 'empty' ? t('comparison.bar.untitled') : savedAnalysis.name}
                </span>
                <span className={styles.analysisId}>
                  {st === 'empty' ? t('comparison.bar.notSaved') : savedAnalysis.id}
                </span>
              </div>
              <span className={styles.analysisSub}>
                {st === 'empty' ? t('comparison.bar.noInputs') : savedAnalysis.meta}
              </span>
            </div>

            <div className={styles.analysisActions}>
              <button
                type="button"
                onClick={() => setSelectInputsOpen(true)}
                className={styles.chip}
                style={{
                  background: 'var(--surface-white)',
                  color: 'var(--ink)',
                  border: '1px solid var(--rule-strong)',
                }}
              >
                {t('comparison.bar.selectInputs')}
              </button>
              {st !== 'empty' ? (
                <>
                  <button
                    type="button"
                    onClick={handleRerun}
                    className={styles.chip}
                    style={{
                      background: 'var(--surface-white)',
                      color: 'var(--ink)',
                      border: '1px solid var(--rule-strong)',
                    }}
                  >
                    {savedAnalysis.rerunLabel}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAnalysis}
                    disabled={!canEdit}
                    className={styles.chip}
                    style={{
                      background: 'var(--accent)',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 500,
                    }}
                  >
                    {t('comparison.bar.saveAnalysis')}
                  </button>
                </>
              ) : null}
            </div>

            {savedAnalysis.changed && st !== 'empty' ? (
              <div className={styles.inputsChangedNotice}>
                <span className={styles.inputsChangedBadge}>
                  {t('comparison.bar.inputsChangedTitle')}
                </span>
                {t('comparison.bar.inputsChangedBody', {
                  item: 'OCC-TIR-000044',
                  version: 'v2026.09',
                  oldVersion: '2',
                  newVersion: '3',
                })}
              </div>
            ) : null}

            {toastMessage ? (
              <div
                style={{
                  flex: '1 1 100%',
                  padding: '6px 10px',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent-dark)',
                  fontSize: '12px',
                  borderRadius: '2px',
                }}
              >
                {toastMessage}
              </div>
            ) : null}
          </div>

          {/* Mode tab list */}
          <div role="tablist" aria-label="Comparison mode" className={styles.tabList}>
            {(['occ', 'chains', 'dossier', 'crit'] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={view === m}
                onClick={() => handleTabChange(m)}
                className={[
                  styles.tabBtn,
                  view === m ? styles.tabBtnActive : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {t(`comparison.modes.${m}`)}
              </button>
            ))}
          </div>

          {/* View body */}
          {st === 'loading' ? (
            <div aria-busy="true" className={styles.skeletonGrid}>
              <div className={styles.skeletonCard} />
              <div className={styles.skeletonCard} />
              <div className={styles.skeletonCard} />
            </div>
          ) : st === 'empty' ? (
            <div className={styles.stateContainer}>
              <div className={styles.emptyCard}>
                <h2 className={styles.emptyTitle}>{emptyTitle}</h2>
                <p className={styles.emptyText}>{emptyBody}</p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setSelectInputsOpen(true)}
                    className={styles.chip}
                    style={{
                      background: 'var(--accent)',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 500,
                      padding: '9px 14px',
                      fontSize: '14px',
                    }}
                  >
                    {t('comparison.states.selectInputs')}
                  </button>
                  <Link
                    to={`/projects/${projectId}/evidence`}
                    className={styles.chip}
                    style={{
                      background: 'var(--surface-white)',
                      color: 'var(--ink)',
                      border: '1px solid var(--rule-strong)',
                      padding: '9px 14px',
                      fontSize: '14px',
                      textDecoration: 'none',
                    }}
                  >
                    {t('comparison.states.pickFromEvidence')}
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <>
              {view === 'occ' ? (
                <OccurrencesView
                  columns={effectiveOccCols}
                  showDiff={diff}
                  onToggleDiff={() => setDiff(!diff)}
                  onAnnotate={handleAnnotate}
                  projectId={projectId}
                />
              ) : null}

              {view === 'chains' ? (
                <ChainsView
                  chains={DEFAULT_CHAINS}
                  onOpenDossier={() => handleTabChange('dossier')}
                />
              ) : null}

              {view === 'dossier' ? (
                <DossierView onGoCriticism={() => handleTabChange('crit')} />
              ) : null}

              {view === 'crit' ? <CriticismView /> : null}
            </>
          )}
        </>
      )}

      {/* Modals */}
      {selectInputsOpen ? (
        <SelectInputsModal
          onClose={() => setSelectInputsOpen(false)}
          onApply={() => {
            setSt('normal')
          }}
        />
      ) : null}

      {annotateOpen ? (
        <AnnotateModal
          colId={annotateTargetCol}
          onClose={() => setAnnotateOpen(false)}
          onSave={handleSaveAnnotation}
        />
      ) : null}
    </div>
  )
}
