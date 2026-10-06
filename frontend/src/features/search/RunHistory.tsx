import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { compareRuns, listResultSets, listRuns } from '@/api/searchWorkspace'
import type { SavedQuery } from '@/api/schemas/search'
import { usePreferences } from '@/app/preferencesContext'
import { Button } from '@/components/Button'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { formatCode } from '@/domain/codes'
import { queryCode, runCode } from './searchModel'
import styles from './Search.module.css'
import { qk } from '@/api/queryKeys'

/** Every run of one saved search, oldest numbered first, with a two-run comparison and the result sets saved from them. */
export function RunHistory({
  projectId,
  query,
  onBack,
}: {
  projectId: number
  query: SavedQuery
  onBack: () => void
}) {
  const { t } = useTranslation()
  const { date, n } = usePreferences()
  const [picked, setPicked] = useState<number[]>([])

  const runsQ = useQuery({
    queryKey: qk.project(projectId).search.runs,
    queryFn: ({ signal }) => listRuns(projectId, signal),
  })
  const setsQ = useQuery({
    queryKey: qk.project(projectId).search.resultSets,
    queryFn: ({ signal }) => listResultSets(projectId, signal),
  })

  const mine = (runsQ.data ?? [])
    .filter((r) => r.saved_query_id === query.id)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || a.id - b.id)
  const ordinalOf = new Map(mine.map((r, i) => [r.id, i + 1]))
  const codeOf = (id: number) => runCode(query.id, ordinalOf.get(id) ?? 0)
  const rows = [...mine].reverse()
  const setsFor = (runId: number) => (setsQ.data ?? []).filter((s) => s.search_run_id === runId)

  const compare = useMutation({
    mutationFn: ([a, b]: [number, number]) => compareRuns(projectId, a, b),
  })

  const toggle = (id: number) => {
    compare.reset()
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur.slice(-1), id]))
  }

  const state = viewStateOf(runsQ, { isEmpty: () => mine.length === 0 })
  // Compare the older run with the newer one, whichever order they were ticked in.
  const ordered = [...picked].sort((a, b) => (ordinalOf.get(a) ?? 0) - (ordinalOf.get(b) ?? 0)) as [number, number]

  return (
    <section aria-label={t('search.history.title', { name: query.name })}>
      <Button variant="ghost" onClick={onBack}>
        {t('search.history.back')}
      </Button>
      <h2 className={styles.historyTitle}>{t('search.history.title', { name: query.name })}</h2>
      <p className={styles.hint}>{t('search.history.sub', { code: queryCode(query.id) })}</p>

      <StateBoundary
        state={state}
        errorValue={runsQ.error}
        onRetry={() => void runsQ.refetch()}
        empty={<p className={styles.hint}>{t('search.history.empty')}</p>}
      >
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">
                <span className={styles.srOnly}>{t('search.history.compare')}</span>
              </th>
              {(['run', 'executed', 'version', 'corpus', 'results', 'status'] as const).map((c) => (
                <th key={c} scope="col">
                  {t(`search.history.columns.${c}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={picked.includes(r.id)}
                    onChange={() => toggle(r.id)}
                    aria-label={t('search.history.compareSelect', { code: codeOf(r.id) })}
                  />
                </td>
                <th scope="row" className="mono">
                  {codeOf(r.id)}
                  {setsFor(r.id).map((s) => (
                    <div key={s.id} className={styles.hint}>
                      {formatCode('RS', s.id)} · {s.name}
                    </div>
                  ))}
                </th>
                <td>{r.created_at ? date(r.created_at, { time: true }) : '—'}</td>
                <td>{t('search.history.version', { version: r.query_version ?? 1 })}</td>
                <td className="mono">{r.corpus_version ?? '—'}</td>
                <td>{r.match_count != null ? n(r.match_count) : '—'}</td>
                <td>{t(`search.run.status.${r.status}`, { defaultValue: r.status })}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={styles.compareBar}>
          {picked.length === 2 ? (
            <Button onClick={() => compare.mutate(ordered)} disabled={compare.isPending}>
              {t('search.history.compareTitle', { a: codeOf(ordered[0]), b: codeOf(ordered[1]) })}
            </Button>
          ) : (
            <span className={styles.hint}>{t('search.history.compareHint')}</span>
          )}
          {compare.data ? (
            <p role="status">
              {t('search.history.compareResult', {
                added: n(compare.data.added_count),
                removed: n(compare.data.removed_count),
                common: n(compare.data.common_count),
              })}
            </p>
          ) : null}
          {compare.isError ? (
            <p role="alert" className={styles.bad}>
              {t('search.history.compareFailed')}
            </p>
          ) : null}
        </div>
      </StateBoundary>
    </section>
  )
}
