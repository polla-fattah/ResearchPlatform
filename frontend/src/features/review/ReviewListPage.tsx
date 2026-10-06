import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { listAssignments } from '@/api/reviews'
import { qk } from '@/api/queryKeys'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { RefreshNotice } from '@/components/RefreshNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { formatCode } from '@/domain/codes'
import { assignmentState, dueState } from './reviewModel'
import styles from './Review.module.css'

/** The packages the person has been asked to review. Only theirs: the server lists the reviewer's own assignments. */
export function ReviewListPage() {
  const { t } = useTranslation()
  const { n, date } = usePreferences()
  const list = useQuery({ queryKey: qk.reviews.list, queryFn: ({ signal }) => listAssignments(signal) })
  const items = list.data ?? []
  const view = list.data ? (items.length === 0 ? 'empty' : 'normal') : viewStateOf(list)
  const asOf = list.dataUpdatedAt

  return (
    <section>
      <div className={styles.head}>
        <h1>{t('review.title')}</h1>
        <p className={styles.sub}>{t('review.intro')}</p>
      </div>
      <StateBoundary
        state={view}
        errorValue={list.error}
        onRetry={() => void list.refetch()}
        empty={
          <div className={styles.empty}>
            <h2>{t('review.noneTitle')}</h2>
            <p>{t('review.noneBody')}</p>
          </div>
        }
      >
        <RefreshNotice query={list} what={t('review.title')} />
        <table className={styles.table} aria-label={t('review.title')}>
          <thead>
            <tr>
              <th scope="col">{t('review.table.package')}</th>
              <th scope="col">{t('review.table.state')}</th>
              <th scope="col">{t('review.table.due')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => {
              const state = assignmentState(a)
              const due = dueState(a, asOf)
              return (
                <tr key={a.id}>
                  <th scope="row">
                    <Link to={`/review/${a.id}`}>
                      <BidiText>{a.submission?.title ?? t('review.untitled')}</BidiText>
                    </Link>
                    <div className={styles.meta}>
                      <span className="mono">{a.submission ? formatCode('SUB', a.submission.id) : ''}</span>
                      {a.submission?.version_number ? ` · ${t('review.table.version', { version: n(a.submission.version_number) })}` : ''}
                    </div>
                  </th>
                  <td>{t(`review.states.${state}`)}</td>
                  <td>
                    {a.due_date ? date(a.due_date) : <span className={styles.meta}>{t('review.table.noDue')}</span>}
                    {due === 'overdue' ? <div className={styles.overdue}>{t('review.table.overdue')}</div> : null}
                    {due === 'soon' ? <div className={styles.meta}>{t('review.table.soon')}</div> : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </StateBoundary>
    </section>
  )
}
