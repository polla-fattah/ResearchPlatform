import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { listThreads, THREADS_PER_PAGE } from '@/api/discussion'
import { qk } from '@/api/queryKeys'
import type { Thread } from '@/api/schemas/discussion'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { Pagination } from '@/components/Pagination'
import { RefreshNotice } from '@/components/RefreshNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { formatCode } from '@/domain/codes'
import { useQueryParams } from '@/hooks/useQueryParams'
import { THREAD_FILTERS, threadCounts, visibleThreads, type ThreadFilter } from './discussionModel'
import { ThreadView } from './ThreadView'
import styles from './Discussion.module.css'

interface Props {
  projectId: number
  canStart: boolean
  canReply: boolean
  canResolve: boolean
  onStart: () => void
}

/** The discussions list and the one that is open. Which one, the state filter and the pages are all in the address. */
export function DiscussionsView({ projectId, canStart, canReply, canResolve, onStart }: Props) {
  const { t } = useTranslation()
  const { n, relative } = usePreferences()
  const url = useQueryParams()
  const filter = url.oneOf('state', THREAD_FILTERS, 'open')
  const selected = url.id('thread')
  const page = url.page

  const query = useQuery({
    queryKey: qk.project(projectId).discussion.threads(page),
    queryFn: ({ signal }) => listThreads(projectId, page, signal),
    placeholderData: keepPreviousData,
  })
  const all = query.data?.items ?? []
  const counts = threadCounts(all)
  const shown = visibleThreads(all, filter)
  const open: Thread | undefined = all.find((th) => th.id === selected)
  const view = query.data ? 'normal' : viewStateOf(query)
  const paged = (query.data?.pagination?.total_pages ?? 1) > 1

  return (
    <StateBoundary state={view} errorValue={query.error} onRetry={() => void query.refetch()}>
      <RefreshNotice query={query} what={t('discussion.views.discussions')} />
      {all.length === 0 && !paged ? (
        <div className={styles.empty}>
          <h3>{t('discussion.empty.title')}</h3>
          <p>{t('discussion.empty.body')}</p>
          {canStart ? (
            <Button variant="primary" onClick={onStart}>
              {t('discussion.empty.action')}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className={styles.split}>
          <div>
            <div className={styles.filters} role="group" aria-label={t('discussion.filter.label')}>
              {THREAD_FILTERS.map((f: ThreadFilter) => (
                <button key={f} type="button" className={styles.chip} aria-pressed={filter === f} onClick={() => url.set({ state: f === 'open' ? null : f })}>
                  {t(`discussion.filter.${f}`, { count: counts[f], formattedCount: n(counts[f]) })}
                </button>
              ))}
            </div>
            {paged ? <p className={styles.meta}>{t('discussion.filter.pageNote')}</p> : null}
            {shown.length === 0 ? <p className={styles.meta}>{t('discussion.filter.none')}</p> : null}
            <ul className={styles.list} aria-label={t('discussion.list.label')}>
              {shown.map((th) => (
                <li key={th.id}>
                  <button type="button" className={styles.item} aria-current={th.id === selected} onClick={() => url.set({ thread: th.id, cpage: null }, { keepPage: true, push: true })}>
                    <span className={styles.itemTitle}>
                      <BidiText>{th.title}</BidiText>
                    </span>
                    <span className={styles.meta}>
                      <span className={[styles.state, th.is_resolved ? styles.resolved : ''].join(' ')}>
                        {th.is_resolved ? t('discussion.state.resolved') : t('discussion.state.open')}
                      </span>
                      <span className="mono">{formatCode('D', th.id)}</span> ·{' '}
                      {t('discussion.list.replies', { count: th.comments_count ?? 0, formattedCount: n(th.comments_count ?? 0) })}
                      {th.updated_at ? ` · ${relative(th.updated_at)}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {query.data?.pagination ? <Pagination pagination={{ ...query.data.pagination, per_page: THREADS_PER_PAGE }} onPage={(p) => url.set({ page: p })} /> : null}
          </div>
          <div>
            {open ? (
              <ThreadView
                key={open.id}
                projectId={projectId}
                thread={open}
                page={Math.max(1, Number(url.params.get('cpage')) || 1)}
                onPage={(p) => url.set({ cpage: p }, { keepPage: true })}
                canReply={canReply}
                canResolve={canResolve}
              />
            ) : (
              <div className={styles.empty}>
                <p>{selected ? t('discussion.list.notOnPage') : t('discussion.list.pick')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </StateBoundary>
  )
}
