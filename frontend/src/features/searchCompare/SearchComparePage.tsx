import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { compareRunsFull } from '@/api/searchCompare'
import { listRuns, listSavedQueries } from '@/api/searchWorkspace'
import { qk } from '@/api/queryKeys'
import type { SearchRun } from '@/api/schemas/search'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { RefreshNotice } from '@/components/RefreshNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { useProject } from '@/features/projects/useProject'
import { queryCode, runCode } from '@/features/search/searchModel'
import { useQueryParams } from '@/hooks/useQueryParams'
import { ChangeList } from './ChangeList'
import { comparableRuns, corpusChange, inOrder, LISTS, queryEdited, type CompareList } from './compareModel'
import { SchedulePanel } from './SchedulePanel'
import styles from './SearchCompare.module.css'

/**
 * Screen 35. Two runs of one saved query set side by side: which records are new, gone, or in both, from the server's own
 * lists of corpus ids. The design's "changed" kind (a record whose wording or locator differs), per-collection coverage
 * and snapshot ids, adding new records to a result set and downloading the comparison have no server support and are
 * not drawn (request file C-40). Choices live in the address, so a comparison can be shared as a link.
 */
export function SearchComparePage() {
  const { t } = useTranslation()
  const { date, n } = usePreferences()
  const { id: projectId, can } = useProject()
  const url = useQueryParams()
  const pid = projectId ?? 0
  const queryId = url.id('query')
  const aId = url.id('a')
  const bId = url.id('b')
  const show = url.oneOf('show', LISTS, 'added')

  const queries = useQuery({ queryKey: qk.project(pid).search.queries, queryFn: ({ signal }) => listSavedQueries(pid, signal), enabled: projectId !== null })
  const runs = useQuery({ queryKey: qk.project(pid).search.runs, queryFn: ({ signal }) => listRuns(pid, signal), enabled: projectId !== null })
  const mine = queryId && runs.data ? comparableRuns(runs.data, queryId) : []
  const earlier = mine.find((r) => r.id === aId)
  const later = mine.find((r) => r.id === bId)
  const ready = earlier && later && earlier.id !== later.id
  const [first, second] = ready ? inOrder(earlier, later) : [undefined, undefined]
  const compare = useQuery({
    queryKey: qk.project(pid).search.compareFull(first?.id ?? 0, second?.id ?? 0),
    queryFn: ({ signal }) => compareRunsFull(pid, first!.id, second!.id, signal),
    enabled: Boolean(first && second),
  })

  if (projectId === null) return null
  const base = `/projects/${projectId}`
  const state = queries.data && runs.data ? 'normal' : viewStateOf(queries.isPending ? queries : runs)
  const queryList = queries.data ?? []
  const label = (r: SearchRun) => `${runCode(queryId ?? 0, mine.indexOf(r) + 1)} · ${r.created_at ? date(r.created_at) : t('searchCompare.noDate')} · ${t('searchCompare.results', { count: r.match_count ?? 0, n: n(r.match_count ?? 0) })}`
  const diff = compare.data?.diff
  const lists: Record<CompareList, number[]> = { added: diff?.added_ids ?? [], removed: diff?.removed_ids ?? [], kept: diff?.retained_ids ?? [] }
  const change = first && second ? corpusChange(first, second) : null

  return (
    <section aria-label={t('searchCompare.title')}>
      <h1>{t('searchCompare.title')}</h1>
      <p className={styles.sub}>{t('searchCompare.sub')}</p>
      <p className={styles.note} role="note">
        {t('searchCompare.unchecked')}
      </p>
      <StateBoundary state={state} errorValue={queries.error ?? runs.error} onRetry={() => void (queries.isError ? queries.refetch() : runs.refetch())}>
        <RefreshNotice query={queries} what={t('searchCompare.title')} />
        {queryList.length === 0 ? (
          <div className={styles.empty}>
            <h2>{t('searchCompare.noQueries.title')}</h2>
            <p>{t('searchCompare.noQueries.body')}</p>
          </div>
        ) : (
          <>
            <div className={styles.pickers}>
              <Field label={t('searchCompare.query')} requirement="required">
                <select value={queryId ?? ''} onChange={(e) => url.replaceAll({ query: e.target.value })}>
                  <option value="">{t('searchCompare.choose')}</option>
                  {queryList.map((q) => (
                    <option key={q.id} value={q.id}>
                      {queryCode(q.id)} · {q.name}
                    </option>
                  ))}
                </select>
              </Field>
              {queryId ? (
                <>
                  <Field label={t('searchCompare.earlier')} requirement="required">
                    <select value={aId ?? ''} onChange={(e) => url.set({ a: e.target.value })}>
                      <option value="">{t('searchCompare.choose')}</option>
                      {mine.map((r) => (
                        <option key={r.id} value={r.id}>
                          {label(r)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t('searchCompare.later')} requirement="required">
                    <select value={bId ?? ''} onChange={(e) => url.set({ b: e.target.value })}>
                      <option value="">{t('searchCompare.choose')}</option>
                      {mine.map((r) => (
                        <option key={r.id} value={r.id}>
                          {label(r)}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              ) : null}
            </div>
            {!queryId ? <p className={styles.empty}>{t('searchCompare.pickQuery')}</p> : null}
            {queryId && mine.length < 2 ? <p className={styles.empty}>{t('searchCompare.needTwo', { count: mine.length })}</p> : null}
            {queryId && mine.length >= 2 && !ready ? <p className={styles.empty}>{aId && bId && aId === bId ? t('searchCompare.sameRun') : t('searchCompare.pickRuns')}</p> : null}

            {first && second ? (
              <StateBoundary state={compare.data ? 'normal' : viewStateOf(compare)} errorValue={compare.error} onRetry={() => void compare.refetch()}>
                <RefreshNotice query={compare} what={t('searchCompare.title')} />
                {diff ? (
                  <>
                    <p>{t('searchCompare.sameQuery', { code: queryCode(queryId ?? 0) })}</p>
                    {queryEdited(first, second) === 'edited' ? <p className={styles.note}>{t('searchCompare.queryEdited')}</p> : null}
                    {change === 'changed' ? <p className={styles.note}>{t('searchCompare.corpusChanged', { from: first.corpus_version, to: second.corpus_version })}</p> : null}
                    {change === 'unknown' ? <p className={styles.meta}>{t('searchCompare.corpusUnknown')}</p> : null}
                    <ul className={styles.tiles} aria-label={t('searchCompare.summary')}>
                      <li className={styles.tile}>
                        <strong>{n(diff.added_count)}</strong>
                        {t('searchCompare.lists.added')}
                      </li>
                      <li className={styles.tile}>
                        <strong>{n(diff.removed_count)}</strong>
                        {t('searchCompare.lists.removed')}
                      </li>
                      <li className={styles.tile}>
                        <strong>{n(diff.retained_count)}</strong>
                        {t('searchCompare.lists.kept')}
                      </li>
                    </ul>
                    <div className={styles.tabs} role="group" aria-label={t('searchCompare.listsLabel')}>
                      {LISTS.map((l) => (
                        <Button key={l} className={styles.tab} aria-current={l === show} onClick={() => url.set({ show: l === 'added' ? '' : l }, { push: true })}>
                          {t(`searchCompare.lists.${l}`)} ({n(lists[l].length)})
                        </Button>
                      ))}
                    </div>
                    <ChangeList key={show} ids={lists[show]} page={url.page} onPage={(p) => url.set({ page: p }, { keepPage: true })} label={t(`searchCompare.lists.${show}`)} empty={t(`searchCompare.empty.${show}`)} base={base} />
                    <p className={styles.meta}>{t('searchCompare.footnote')}</p>
                  </>
                ) : null}
              </StateBoundary>
            ) : null}

            {queryId ? <SchedulePanel projectId={projectId} queryId={queryId} canEdit={can('editShared')} /> : null}
            {queryId ? (
              <p className={styles.meta}>
                <BidiText>{queryList.find((q) => q.id === queryId)?.name ?? ''}</BidiText>
              </p>
            ) : null}
          </>
        )}
      </StateBoundary>
    </section>
  )
}
