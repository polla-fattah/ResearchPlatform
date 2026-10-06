import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { listPublications, PUBLICATIONS_PER_PAGE } from '@/api/publications'
import { qk } from '@/api/queryKeys'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { Pagination } from '@/components/Pagination'
import { RefreshNotice } from '@/components/RefreshNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { useDraftParam, useQueryParams } from '@/hooks/useQueryParams'
import { excerpt } from '@/features/publicAnnouncements/publicModel'
import { authorsOf, finishedReviewCount } from './publicationModel'
import styles from '@/features/publicAnnouncements/Public.module.css'

const STATUSES = ['', 'retracted'] as const

/**
 * Screen 25. Released publications, found by words. Open to everyone; the server lists only what is released (and, if
 * asked, what was retracted, which stays public with its reason). The words, the status and the page are in the address.
 */
export function ResearchListPage() {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const url = useQueryParams()
  const search = useDraftParam('q', { delay: 300 })
  const status = url.oneOf('status', STATUSES, '')
  const q = url.text('q')
  const query = { q: q || undefined, status: status || undefined, page: url.page }

  const list = useQuery({ queryKey: qk.public.publications(query), queryFn: ({ signal }) => listPublications(query, signal), placeholderData: keepPreviousData })
  const items = list.data?.items ?? []
  const filtered = !!(q || status)
  const view = list.data ? (items.length === 0 ? 'empty' : 'normal') : viewStateOf(list)
  const total = list.data?.pagination?.total_items

  return (
    <div className={styles.wrap}>
      <h1>{t('publications.title')}</h1>
      <p className={styles.intro}>{t('publications.intro')}</p>
      <p>
        <Link to="/announcements">{t('publications.toAnnouncements')}</Link>
      </p>

      <form
        className={styles.filters}
        role="search"
        aria-label={t('publications.filters.label')}
        onSubmit={(e) => {
          e.preventDefault()
          search.commit()
        }}
      >
        <label>
          {t('publications.filters.search')}
          <input type="search" dir="auto" value={search.text} onChange={(e) => search.setText(e.target.value)} />
        </label>
        <label>
          {t('publications.filters.show')}
          <select value={status} onChange={(e) => url.set({ status: e.target.value })}>
            <option value="">{t('publications.filters.published')}</option>
            <option value="retracted">{t('publications.filters.retracted')}</option>
          </select>
        </label>
        {filtered ? <Button onClick={() => url.replaceAll()}>{t('publications.filters.clear')}</Button> : null}
      </form>
      {total !== undefined ? <p className={styles.meta}>{t('publications.count', { count: total })}</p> : null}

      <StateBoundary
        state={view}
        errorValue={list.error}
        onRetry={() => void list.refetch()}
        empty={
          <div className={styles.empty}>
            <h2>{filtered ? t('publications.noneFiltered', { q }) : t('publications.noneTitle')}</h2>
            <p>{filtered ? t('publications.noneFilteredBody') : t('publications.noneBody')}</p>
          </div>
        }
      >
        <RefreshNotice query={list} what={t('publications.title')} />
        <ul className={styles.cards} aria-label={t('publications.title')}>
          {items.map((p) => {
            const names = authorsOf(p)
            const reviews = finishedReviewCount(p)
            return (
              <li key={p.public_slug} className={styles.card}>
                <p className={styles.tag}>
                  {p.status === 'retracted' ? t('publications.retractedTag') : t('publications.tag')}
                  {reviews > 0 ? <span className={styles.stage}>{t('publications.reviewed')}</span> : null}
                </p>
                <h2>
                  <Link to={`/research/${encodeURIComponent(p.public_slug)}`}>
                    <BidiText>{p.title}</BidiText>
                  </Link>
                </h2>
                {p.abstract ? (
                  <p>
                    <BidiText>{excerpt(p.abstract).text}</BidiText>
                  </p>
                ) : null}
                <p className={styles.meta}>
                  {names.length > 0 ? <BidiText>{names.join(' · ')}</BidiText> : null}
                  {names.length > 0 && p.released_at ? ' · ' : ''}
                  {p.released_at ? t('publications.released', { date: date(p.released_at) }) : null}
                  {p.version_string ? ` · ${t('publications.version', { version: p.version_string })}` : ''}
                </p>
              </li>
            )
          })}
        </ul>
        {list.data?.pagination ? <Pagination pagination={{ ...list.data.pagination, per_page: PUBLICATIONS_PER_PAGE }} onPage={(p) => url.set({ page: p })} /> : null}
      </StateBoundary>
      <p className={styles.foot}>{t('publications.scope')}</p>
    </div>
  )
}
