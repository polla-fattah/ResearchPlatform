import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { listEvidence, type EvidenceQuery } from '@/api/evidence'
import { getProjectSummary } from '@/api/projectDetail'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button, ButtonLink } from '@/components/Button'
import { Pagination } from '@/components/Pagination'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { EVIDENCE_STATES } from '@/domain/vocab'
import { useProject } from '@/features/projects/useProject'
import { evidenceCode, stateOf } from './evidenceModel'
import { Inspector } from './Inspector'
import { StateBadge } from './StateBadge'
import styles from './Evidence.module.css'
import { qk } from '@/api/queryKeys'
import { useDraftParam, useQueryParams } from '@/hooks/useQueryParams'

const excerpt = (s: string) => (s.length > 90 ? `${s.slice(0, 90).trimEnd()}…` : s)

export function EvidencePage() {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const { id, can } = useProject()
  const projectId = id ?? 0
  const url = useQueryParams()
  const update = url.set

  const state = stateOf(url.text('state')) ? url.text('state') : ''
  const q = url.text('q')
  const page = url.page
  const selectedId = url.id('item')

  const search = useDraftParam('q', { delay: 300 })

  const query: EvidenceQuery = { state: state || undefined, q: q || undefined, page, per_page: 20 }
  const list = useQuery({
    queryKey: qk.project(projectId).evidence.list(query),
    queryFn: ({ signal }) => listEvidence(projectId, query, signal),
    enabled: id !== null,
    placeholderData: keepPreviousData,
  })
  // Counts per state come from the project summary (the list endpoint pages and filters).
  const summary = useQuery({
    queryKey: qk.project(projectId).summary,
    queryFn: ({ signal }) => getProjectSummary(projectId, signal),
    enabled: id !== null,
  })
  const counts = summary.data?.evidence_counts
  const total = counts?.total ?? list.data?.pagination?.total_items ?? 0

  const filtered = !!(state || q)
  const view = viewStateOf(list, { isEmpty: (d) => (d as { items: unknown[] }).items.length === 0 })
  const firstRun = view === 'empty' && !filtered

  const canEdit = can('editShared')
  const canAnnotate = can('comment') || can('createPrivateAnnotation')

  return (
    <section>
      <div className={styles.pageHead}>
        <div>
          <h1>{t('evidence.title')}</h1>
          {counts || list.data ? (
            <p className={styles.hint}>{t('units.evidence', { count: total, formattedCount: n(total) })}</p>
          ) : null}
        </div>
      </div>

      {firstRun ? (
        <div className={styles.empty}>
          <h2>{t('evidence.empty.title')}</h2>
          <p>{t('evidence.empty.body')}</p>
          <div className={styles.actions}>
            <ButtonLink variant="primary" to={`/projects/${projectId}/searches`}>
              {t('evidence.empty.search')}
            </ButtonLink>
            <ButtonLink to={`/projects/${projectId}/resources`}>{t('evidence.empty.resources')}</ButtonLink>
          </div>
        </div>
      ) : (
        <div className={styles.layout}>
          <div className={styles.listCol}>
            <div className={styles.filters}>
              <input
                type="search"
                value={search.text}
                aria-label={t('evidence.list.search')}
                placeholder={t('evidence.list.search')}
                onChange={(e) => search.setText(e.target.value)}
              />
              <div role="group" aria-label={t('evidence.state.heading')} className={styles.chips}>
                <button
                  type="button"
                  className={[styles.chip, state === '' ? styles.chipOn : ''].join(' ')}
                  aria-pressed={state === ''}
                  onClick={() => update({ state: null })}
                >
                  {t('evidence.list.all')} {counts ? <span className={styles.count}>{n(counts.total)}</span> : null}
                </button>
                {EVIDENCE_STATES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={[styles.chip, state === s ? styles.chipOn : ''].join(' ')}
                    aria-pressed={state === s}
                    onClick={() => update({ state: s })}
                  >
                    {t(`evidenceState.${s}`)} {counts ? <span className={styles.count}>{n(counts[s])}</span> : null}
                  </button>
                ))}
              </div>
            </div>

            <StateBoundary
              state={view}
              errorValue={list.error}
              error={
                <div className={styles.banner} role="alert">
                  <h2>{t('evidence.list.loadFailed.title')}</h2>
                  <p>{t('evidence.list.loadFailed.body')}</p>
                  <Button onClick={() => void list.refetch()}>{t('common.retry')}</Button>
                </div>
              }
              empty={
                <div className={styles.notice}>
                  <h2>{t('evidence.list.noMatch.title')}</h2>
                  <p>{t('evidence.list.noMatch.body')}</p>
                </div>
              }
            >
              <ul className={[styles.items, list.isPlaceholderData ? styles.dim : ''].join(' ')}>
                {list.data?.items.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      className={[styles.item, e.id === selectedId ? styles.itemOn : ''].join(' ')}
                      aria-current={e.id === selectedId ? 'true' : undefined}
                      onClick={() => update({ item: String(e.id) }, { keepPage: true })}
                    >
                      <span className={styles.itemTop}>
                        <StateBadge state={e.state} />
                        <span className="mono">{evidenceCode(e.id)}</span>
                      </span>
                      <span className={styles.itemTitle}>
                        <BidiText>{e.resource?.title ?? evidenceCode(e.id)}</BidiText>
                      </span>
                      <span className={styles.itemText}>
                        <BidiText>{excerpt(e.captured_text)}</BidiText>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {list.data?.pagination ? (
                <Pagination pagination={list.data.pagination} onPage={(p) => update({ page: String(p) }, { keepPage: true })} />
              ) : null}
            </StateBoundary>
          </div>

          <div className={styles.inspectorCol}>
            {selectedId ? (
              <Inspector
                key={selectedId}
                projectId={projectId}
                id={selectedId}
                canEdit={canEdit}
                canAnnotate={canAnnotate}
                onRemoved={() => update({ item: null }, { keepPage: true })}
              />
            ) : (
              <p className={styles.hint}>{t('evidence.inspector.pick')}</p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
