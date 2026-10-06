import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { listPublicAnnouncements, PUBLIC_ANNOUNCEMENTS_PER_PAGE } from '@/api/publicAnnouncements'
import { qk } from '@/api/queryKeys'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { Pagination } from '@/components/Pagination'
import { RefreshNotice } from '@/components/RefreshNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { isProjectStage } from '@/domain/vocab'
import { useDraftParam, useQueryParams } from '@/hooks/useQueryParams'
import { creditedNames, excerpt, STAGE_FILTERS } from './publicModel'
import styles from './Public.module.css'

/**
 * Screen 20 (list). Open to everyone, no sign-in. The search words, the stage and the page are in the address; what is
 * listed is exactly what the server's public list returns (published announcements only).
 */
export function AnnouncementsListPage() {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const url = useQueryParams()
  const search = useDraftParam('q', { delay: 300 })
  const stage = url.oneOf('stage', STAGE_FILTERS, '')
  const q = url.text('q')
  const query = { q: q || undefined, research_stage: stage || undefined, page: url.page }

  const list = useQuery({
    queryKey: qk.public.announcements(query),
    queryFn: ({ signal }) => listPublicAnnouncements(query, signal),
    placeholderData: keepPreviousData,
  })
  const items = list.data?.items ?? []
  const filtered = !!(q || stage)
  const view = list.data ? (items.length === 0 ? 'empty' : 'normal') : viewStateOf(list)

  return (
    <div className={styles.wrap}>
      <h1>{t('publicAnnouncements.title')}</h1>
      <p className={styles.intro}>{t('publicAnnouncements.intro')}</p>

      <form
        className={styles.filters}
        role="search"
        aria-label={t('publicAnnouncements.filters.label')}
        onSubmit={(e) => {
          e.preventDefault()
          search.commit()
        }}
      >
        <label>
          {t('publicAnnouncements.filters.search')}
          <input type="search" dir="auto" value={search.text} onChange={(e) => search.setText(e.target.value)} />
        </label>
        <label>
          {t('publicAnnouncements.filters.stage')}
          <select value={stage} onChange={(e) => url.set({ stage: e.target.value })}>
            <option value="">{t('publicAnnouncements.filters.anyStage')}</option>
            {STAGE_FILTERS.filter(Boolean).map((s) => (
              <option key={s} value={s}>
                {t(`stage.${s}`)}
              </option>
            ))}
          </select>
        </label>
        {filtered ? <Button onClick={() => url.replaceAll()}>{t('publicAnnouncements.filters.clear')}</Button> : null}
      </form>

      <StateBoundary
        state={view}
        errorValue={list.error}
        onRetry={() => void list.refetch()}
        empty={
          <div className={styles.empty}>
            <h2>{filtered ? t('publicAnnouncements.noneFiltered', { q }) : t('publicAnnouncements.noneTitle')}</h2>
            <p>{filtered ? t('publicAnnouncements.noneFilteredBody') : t('publicAnnouncements.noneBody')}</p>
          </div>
        }
      >
        <RefreshNotice query={list} what={t('publicAnnouncements.title')} />
        <ul className={styles.cards} aria-label={t('publicAnnouncements.title')}>
          {items.map((a) => {
            const summary = excerpt(a.summary)
            const names = creditedNames(a.project?.owner)
            const stageKey = a.research_stage ?? ''
            return (
              <li key={a.public_slug} className={styles.card}>
                <p className={styles.tag}>
                  {t('publicAnnouncements.tag')}
                  {stageKey ? <span className={styles.stage}>{isProjectStage(stageKey) ? t(`stage.${stageKey}`) : stageKey}</span> : null}
                </p>
                <h2>
                  <Link to={`/announcements/${encodeURIComponent(a.public_slug)}`}>
                    <BidiText>{a.title}</BidiText>
                  </Link>
                </h2>
                <p>
                  <BidiText>{summary.text}</BidiText>
                </p>
                <p className={styles.meta}>
                  {names.length > 0 ? <BidiText>{names.join(' · ')}</BidiText> : null}
                  {names.length > 0 && a.published_at ? ' · ' : ''}
                  {a.published_at ? t('publicAnnouncements.published', { date: date(a.published_at) }) : null}
                </p>
              </li>
            )
          })}
        </ul>
        {list.data?.pagination ? <Pagination pagination={{ ...list.data.pagination, per_page: PUBLIC_ANNOUNCEMENTS_PER_PAGE }} onPage={(p) => url.set({ page: p })} /> : null}
      </StateBoundary>
    </div>
  )
}
