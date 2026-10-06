import { useQueries, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getEvidence, listEvidence } from '@/api/evidence'
import { qk } from '@/api/queryKeys'
import { usePreferences } from '@/app/preferencesContext'
import type { MatnVariant } from '@/api/schemas/analyses'
import { VisibilityBadge } from '@/components/Badges'
import { Button } from '@/components/Button'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { evidenceCode, hadithIdOf } from '../evidence/evidenceModel'
import { AnnotateDialog } from './AnnotateDialog'
import { occurrenceLabel, reportCode } from './comparisonModel'
import { MatnColumns } from './MatnColumns'
import { SaveAnalysis } from './SaveAnalysis'
import { useMatnCompare, useReports } from './useComparison'
import { ViewEmpty } from './ViewEmpty'
import styles from './Comparison.module.css'

interface Props {
  projectId: number
  reportIds: number[]
  baseline: number | undefined
  canEdit: boolean
  onBaseline: (id: number) => void
  onSelect: () => void
}

/** Screen 10, Occurrences: the picked reports side by side in their original wording, with the researcher's notes. */
export function OccurrencesView({ projectId, reportIds, baseline, canEdit, onBaseline, onSelect }: Props) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const [highlight, setHighlight] = useState(true)
  const [annotating, setAnnotating] = useState<{
    evidenceId: number
    about: string
  } | null>(null)

  const loaded = useReports(reportIds)
  const present = reportIds.filter((id) => !loaded.missing.includes(id))
  const compare = useMatnCompare(projectId, present, baseline)

  // Notes live on evidence items, so a text can carry them only if the project holds it as evidence.
  const evidence = useQuery({
    queryKey: qk.project(projectId).evidence.list({ per_page: 100 }),
    queryFn: ({ signal }) => listEvidence(projectId, { per_page: 100 }, signal),
  })
  const evidenceOf = new Map<number, number>()
  for (const item of evidence.data?.items ?? []) {
    const id = hadithIdOf(item.resource)
    if (id !== null && !evidenceOf.has(id)) evidenceOf.set(id, item.id)
  }
  const notes = useQueries({
    queries: present.flatMap((id) => {
      const ev = evidenceOf.get(id)
      return ev === undefined
        ? []
        : [
            {
              queryKey: qk.project(projectId).evidence.item(ev),
              queryFn: ({ signal }: { signal: AbortSignal }) => getEvidence(projectId, ev, signal),
            },
          ]
    }),
  })
  const notesOf = (evidenceId: number) => notes.find((q) => q.data?.id === evidenceId)?.data?.annotations ?? []

  if (reportIds.length === 0) return <ViewEmpty view="occ" canSelect onSelect={onSelect} />

  const describe = (v: MatnVariant) => {
    const id = Number(v.id)
    const place = occurrenceLabel(loaded.reports.find((r) => r.id === id))
    const ev = evidenceOf.get(id)
    return {
      title: place.book ? `${place.book}${place.number !== null ? ` · ${place.number}` : ''}` : reportCode(id),
      sub: (
        <>
          <span className={styles.mono}>{reportCode(id)}</span>
          {ev !== undefined ? <span className={styles.mono}> · {evidenceCode(ev)}</span> : null}
          {place.extra > 0 ? ` · ${t('comparison.occ.otherPlaces', { count: place.extra, formattedCount: n(place.extra) })}` : ''}
        </>
      ),
    }
  }

  const state = loaded.pending ? 'loading' : loaded.failed ? 'error' : present.length < 2 ? 'empty' : viewStateOf(compare)

  return (
    <section aria-label={t('comparison.views.occ')}>
      {loaded.missing.map((id) => (
        <p key={id} className={styles.notice} role="note">
          {t('comparison.occ.missing', { code: reportCode(id) })}
        </p>
      ))}
      <StateBoundary
        state={state}
        errorValue={compare.error}
        onRetry={() => void compare.refetch()}
        empty={
          <div className={styles.empty}>
            <h2>{t('comparison.occ.tooFew.title')}</h2>
            <p>{t('comparison.occ.tooFew.body')}</p>
            <Button variant="primary" onClick={onSelect}>
              {t('comparison.bar.select')}
            </Button>
          </div>
        }
      >
        {compare.data ? (
          <>
            <div className={styles.toolbar}>
              <p>
                {t('comparison.occ.summaryLine', {
                  count: compare.data.variant_count,
                  formattedCount: n(compare.data.variant_count),
                })}
              </p>
              <label className={styles.toggle}>
                <input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} />
                {t('comparison.occ.highlight')}
              </label>
              <p className={styles.legend}>
                <span>
                  <span className={styles.swatch} aria-hidden="true" />
                  {t('comparison.occ.legendSome')}
                </span>
              </p>
              {canEdit ? <SaveAnalysis projectId={projectId} inputs={{ kind: 'matn', hadithIds: present }} baseline={baseline} /> : null}
            </div>
            <MatnColumns
              result={compare.data}
              highlight={highlight}
              describe={describe}
              onBaseline={(id) => onBaseline(Number(id))}
              footer={(v) => {
                const ev = evidenceOf.get(Number(v.id))
                return (
                  <div>
                    <h4 className={styles.hint}>{t('comparison.occ.notes')}</h4>
                    {ev === undefined ? (
                      <p className={styles.hint}>{t('comparison.occ.notEvidence')}</p>
                    ) : (
                      <>
                        {notesOf(ev).length === 0 ? <p className={styles.hint}>{t('comparison.occ.noNotes')}</p> : null}
                        <ul className={styles.noteList}>
                          {notesOf(ev).map((a) => (
                            <li key={a.id} className={styles.noteItem}>
                              {a.visibility === 'private' ? (
                                <VisibilityBadge visibility="private" />
                              ) : (
                                <VisibilityBadge visibility="project" />
                              )}{' '}
                              {a.author?.display_name ? `${a.author.display_name}: ` : ''}
                              {a.body}
                            </li>
                          ))}
                        </ul>
                        {canEdit ? (
                          <Button
                            onClick={() =>
                              setAnnotating({
                                evidenceId: ev,
                                about: describe(v).title,
                              })
                            }
                          >
                            {t('comparison.occ.annotate')}
                          </Button>
                        ) : null}
                      </>
                    )}
                  </div>
                )
              }}
            />
          </>
        ) : null}
      </StateBoundary>
      {annotating ? (
        <AnnotateDialog
          projectId={projectId}
          evidenceId={annotating.evidenceId}
          about={annotating.about}
          onClose={() => setAnnotating(null)}
        />
      ) : null}
    </section>
  )
}
