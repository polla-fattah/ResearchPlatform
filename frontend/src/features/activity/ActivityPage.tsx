import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ACTIVITY_PER_PAGE, listActivity } from '@/api/activity'
import { listMembers } from '@/api/members'
import { qk } from '@/api/queryKeys'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { NeutralState } from '@/components/Badges'
import { Pagination } from '@/components/Pagination'
import { RefreshNotice } from '@/components/RefreshNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { useProject } from '@/features/projects/useProject'
import { useNow } from '@/hooks/useNow'
import { useQueryParams } from '@/hooks/useQueryParams'
import { activityHref, groupByDay, isKnownAction, KNOWN_ACTIONS, KNOWN_OBJECTS, RANGES, rangeStart, visibleSummary } from './activityModel'
import styles from './Activity.module.css'

/**
 * Screen 18. Every filter and the page are in the address. The feed is what the server records in its activity table
 * (a handful of kinds, listed in the filter); the sentences are the server's own. Nothing here counts or groups beyond
 * the day an entry happened.
 */
export function ActivityPage() {
  const { t } = useTranslation()
  const { n, date } = usePreferences()
  const { id, can } = useProject()
  const url = useQueryParams()
  const now = useNow()
  const range = url.oneOf('range', RANGES, 'all')
  const actor = url.id('actor')
  const object = url.oneOf('object', ['', ...KNOWN_OBJECTS] as const, '')
  const action = url.oneOf('action', ['', ...KNOWN_ACTIONS] as const, '')
  const projectId = id ?? 0

  const query = { actor_id: actor, object_type: object || undefined, action: action || undefined, from: rangeStart(range, now), page: url.page }
  const feed = useQuery({
    queryKey: qk.project(projectId).activity(query),
    queryFn: ({ signal }) => listActivity(projectId, query, signal),
    enabled: id !== null,
    placeholderData: keepPreviousData,
  })
  const members = useQuery({ queryKey: qk.project(projectId).members.list, queryFn: ({ signal }) => listMembers(projectId, signal), enabled: id !== null })

  if (id === null) return null
  const items = feed.data?.items ?? []
  const filtered = !!(actor || object || action || range !== 'all')
  const view = feed.data ? (items.length === 0 ? 'empty' : 'normal') : viewStateOf(feed)
  const total = feed.data?.pagination?.total_items
  const owner = can('manageMembers')

  return (
    <section>
      <div className={styles.head}>
        <h2>{t('activity.title')}</h2>
        <p className={styles.sub}>{total !== undefined ? t('activity.count', { count: total, formattedCount: n(total) }) : null}</p>
      </div>
      <p className={styles.scope}>{t('activity.scope')}</p>

      <div className={styles.filters} role="group" aria-label={t('activity.filters.label')}>
        <label>
          {t('activity.filters.who')}
          <select value={actor ?? ''} onChange={(e) => url.set({ actor: e.target.value })}>
            <option value="">{t('activity.filters.anyone')}</option>
            {(members.data ?? []).map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.user?.display_name ?? m.user_id}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('activity.filters.object')}
          <select value={object} onChange={(e) => url.set({ object: e.target.value })}>
            <option value="">{t('activity.filters.anyObject')}</option>
            {KNOWN_OBJECTS.map((o) => (
              <option key={o} value={o}>
                {t(`activity.objects.${o}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('activity.filters.action')}
          <select value={action} onChange={(e) => url.set({ action: e.target.value })}>
            <option value="">{t('activity.filters.anyAction')}</option>
            {KNOWN_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {t(`activity.actions.${a}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('activity.filters.when')}
          <select value={range} onChange={(e) => url.set({ range: e.target.value === 'all' ? null : e.target.value })}>
            {RANGES.map((r) => (
              <option key={r} value={r}>
                {t(`activity.ranges.${r}`)}
              </option>
            ))}
          </select>
        </label>
        {filtered ? (
          <Button onClick={() => url.replaceAll()}>{t('activity.filters.clear')}</Button>
        ) : null}
      </div>

      <StateBoundary
        state={view}
        errorValue={feed.error}
        onRetry={() => void feed.refetch()}
        empty={
          <div className={styles.empty}>
            <h3>{filtered ? t('activity.noneFiltered') : t('activity.emptyTitle')}</h3>
            <p>{filtered ? t('activity.noneFilteredBody') : t('activity.emptyBody')}</p>
          </div>
        }
      >
        <RefreshNotice query={feed} what={t('activity.title')} />
        {groupByDay(items).map((group) => (
          <section key={group.day || 'unknown'} className={styles.day} aria-label={group.day ? date(group.day) : t('activity.noDay')}>
            <h3>{group.day ? date(group.day, { weekday: true }) : t('activity.noDay')}</h3>
            <ol className={styles.list}>
              {group.items.map((a) => {
                const text = visibleSummary(a, owner)
                const href = activityHref(id, a)
                return (
                  <li key={a.id} className={styles.row}>
                    <span className={styles.time}>{a.created_at ? date(a.created_at, { time: true }) : ''}</span>
                    <div>
                      <span className={styles.who}>
                        <BidiText>{a.actor?.display_name ?? t('activity.unknownActor')}</BidiText>
                      </span>
                      <p className={styles.text}>{text ? <BidiText>{text}</BidiText> : <NeutralState kind="limitation">{t(`activity.hidden.${a.action}`, { defaultValue: t('activity.hidden.other') })}</NeutralState>}</p>
                      {href ? <Link to={href}>{t('activity.open')}</Link> : null}
                    </div>
                    <span className={styles.kind}>{isKnownAction(a.action) ? t(`activity.actions.${a.action}`) : a.action}</span>
                  </li>
                )
              })}
            </ol>
          </section>
        ))}
        {feed.data?.pagination ? <Pagination pagination={{ ...feed.data.pagination, per_page: ACTIVITY_PER_PAGE }} onPage={(p) => url.set({ page: p })} /> : null}
      </StateBoundary>
    </section>
  )
}
