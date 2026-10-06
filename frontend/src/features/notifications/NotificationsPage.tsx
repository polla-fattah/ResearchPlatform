import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { listAssignedTasks, listNotifications, markAllRead, markRead, NOTIFICATIONS_PER_PAGE } from '@/api/notifications'
import { invalidate } from '@/api/invalidate'
import { qk } from '@/api/queryKeys'
import { usePreferences } from '@/app/preferencesContext'
import { Button, ButtonLink } from '@/components/Button'
import { MutationNotice } from '@/components/MutationNotice'
import { Pagination } from '@/components/Pagination'
import { RefreshNotice } from '@/components/RefreshNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { useQueryParams } from '@/hooks/useQueryParams'
import { NotificationRow } from './NotificationRow'
import { KNOWN_TYPES, needsTaskLookup, notificationHref } from './notificationsModel'
import styles from './Notifications.module.css'

const FILTERS = ['all', ...KNOWN_TYPES] as const

/**
 * Screen 17. The kind filter, "unread only" and the page are in the address. The list is the server's (unread first);
 * "unread only" narrows the page that is loaded. Reading one or all changes the server, and the list, the count in the
 * rail and the count on Home are refreshed from it: nothing is marked locally first.
 */
export function NotificationsPage() {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const qc = useQueryClient()
  const url = useQueryParams()
  const type = url.oneOf('type', FILTERS, 'all')
  const unreadOnly = url.text('unread') === '1'
  const query = { type: type === 'all' ? undefined : type, page: url.page }

  const list = useQuery({
    queryKey: qk.notifications.list(query),
    queryFn: ({ signal }) => listNotifications(query, signal),
    placeholderData: keepPreviousData,
  })
  const all = list.data?.items ?? []
  const tasks = useQuery({
    queryKey: qk.notifications.assignedTasks,
    queryFn: ({ signal }) => listAssignedTasks(signal),
    enabled: needsTaskLookup(all),
    retry: false,
  })
  const projectOfTask = (id: number) => tasks.data?.find((x) => x.id === id)?.project_id ?? null

  const read = useMutation({ mutationFn: (id: number) => markRead(id), onSuccess: () => invalidate.notificationsChanged(qc) })
  const readAll = useMutation({ mutationFn: markAllRead, onSuccess: () => invalidate.notificationsChanged(qc) })

  const shown = unreadOnly ? all.filter((x) => !x.is_read) : all
  const view = list.data ? (shown.length === 0 ? 'empty' : 'normal') : viewStateOf(list)
  const filtered = type !== 'all' || unreadOnly
  const unread = list.data?.unread
  const total = list.data?.pagination?.total_items

  return (
    <section>
      <div className={styles.head}>
        <div>
          <h1>{t('notifications.title')}</h1>
          <p className={styles.sub}>
            {unread !== undefined ? t('notifications.unreadCount', { count: unread, formattedCount: n(unread) }) : null}
            {total !== undefined && !filtered ? ` · ${t('notifications.totalCount', { count: total, formattedCount: n(total) })}` : ''}
          </p>
        </div>
        <div className={styles.actions}>
          <Button onClick={() => readAll.mutate()} disabled={readAll.isPending || !unread}>
            {t('notifications.markAll')}
          </Button>
          <ButtonLink to="/settings?tab=notifications">{t('notifications.preferences')}</ButtonLink>
        </div>
      </div>
      <MutationNotice error={readAll.error ?? read.error} title={t('notifications.readFailed')} />

      <div className={styles.filters} role="group" aria-label={t('notifications.filter.label')}>
        {FILTERS.map((f) => (
          <button key={f} type="button" className={styles.chip} aria-pressed={type === f} onClick={() => url.set({ type: f === 'all' ? null : f })}>
            {f === 'all' ? t('notifications.filter.all') : t(`notifications.kinds.${f}`)}
          </button>
        ))}
        <button type="button" className={styles.chip} aria-pressed={unreadOnly} onClick={() => url.set({ unread: unreadOnly ? null : '1' }, { keepPage: true })}>
          {t('notifications.filter.unread')}
        </button>
      </div>

      <StateBoundary
        state={view}
        errorValue={list.error}
        onRetry={() => void list.refetch()}
        empty={
          <div className={styles.empty}>
            <h2>{filtered ? t('notifications.noneFiltered') : t('notifications.emptyTitle')}</h2>
            {!filtered ? <p>{t('notifications.emptyBody')}</p> : null}
          </div>
        }
      >
        <RefreshNotice query={list} what={t('notifications.title')} />
        {unreadOnly && list.data?.pagination && list.data.pagination.total_pages > 1 ? <p className={styles.sub}>{t('notifications.unreadPageNote')}</p> : null}
        <ul className={styles.list} aria-label={t('notifications.title')}>
          {shown.map((item) => (
            <NotificationRow
              key={item.id}
              item={item}
              href={notificationHref(item, projectOfTask)}
              busy={read.isPending && read.variables === item.id}
              onRead={() => read.mutate(item.id)}
            />
          ))}
        </ul>
        {list.data?.pagination ? <Pagination pagination={{ ...list.data.pagination, per_page: NOTIFICATIONS_PER_PAGE }} onPage={(p) => url.set({ page: p })} /> : null}
      </StateBoundary>
    </section>
  )
}
