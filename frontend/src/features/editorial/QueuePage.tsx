import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { listQueue, QUEUE_PER_PAGE } from '@/api/editorial'
import { qk } from '@/api/queryKeys'
import { QUEUE_STAGES } from '@/api/schemas/editorial'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { Pagination } from '@/components/Pagination'
import { RefreshNotice } from '@/components/RefreshNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { formatCode } from '@/domain/codes'
import { useNow } from '@/hooks/useNow'
import { useDraftParam, useQueryParams } from '@/hooks/useQueryParams'
import { ageDays, caseStage, finishedReviews, waitingOn } from './editorialModel'
import styles from './Editorial.module.css'

const ACTIONS = ['', 'assign_reviewer', 'submit_review', 'editor_decision', 'release'] as const

/**
 * Screen 22, the queue. The stage, the "action needed" filter, the words searched and the page are all in the address
 * and sent to the server; the table is what it returns. Opening a row opens the case.
 */
export function QueuePage() {
  const { t } = useTranslation()
  const { n, date } = usePreferences()
  const now = useNow()
  const url = useQueryParams()
  const search = useDraftParam('q', { delay: 300 })
  const stage = url.oneOf('stage', ['', ...QUEUE_STAGES] as const, '')
  const action = url.oneOf('action', ACTIONS, '')
  const q = url.text('q')
  const query = { stage: stage || undefined, action_required: action || undefined, q: q || undefined, page: url.page }

  const list = useQuery({ queryKey: qk.editor.queue(query), queryFn: ({ signal }) => listQueue(query, signal), placeholderData: keepPreviousData })
  const items = list.data?.items ?? []
  const filtered = !!(stage || action || q)
  const view = list.data ? (items.length === 0 ? 'empty' : 'normal') : viewStateOf(list)
  const total = list.data?.pagination?.total_items

  return (
    <section>
      <div className={styles.head}>
        <h1>{t('editorial.title')}</h1>
        <p className={styles.sub}>{total !== undefined ? t('editorial.count', { count: total, formattedCount: n(total) }) : null}</p>
      </div>

      <div className={styles.chips} role="group" aria-label={t('editorial.filters.stage')}>
        <button type="button" className={styles.chip} aria-pressed={stage === ''} onClick={() => url.set({ stage: null })}>
          {t('editorial.filters.allStages')}
        </button>
        {QUEUE_STAGES.map((s) => (
          <button key={s} type="button" className={styles.chip} aria-pressed={stage === s} onClick={() => url.set({ stage: s })}>
            {t(`editorial.queueStages.${s}`)}
          </button>
        ))}
      </div>
      <form
        className={styles.filters}
        role="search"
        aria-label={t('editorial.filters.label')}
        onSubmit={(e) => {
          e.preventDefault()
          search.commit()
        }}
      >
        <label>
          {t('editorial.filters.search')}
          <input type="search" dir="auto" value={search.text} onChange={(e) => search.setText(e.target.value)} />
        </label>
        <label>
          {t('editorial.filters.action')}
          <select value={action} onChange={(e) => url.set({ action: e.target.value })}>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a === '' ? t('editorial.filters.anyAction') : t(`editorial.actions.${a}`)}
              </option>
            ))}
          </select>
        </label>
        {filtered ? <Button onClick={() => url.replaceAll()}>{t('editorial.filters.clear')}</Button> : null}
      </form>

      <StateBoundary
        state={view}
        errorValue={list.error}
        onRetry={() => void list.refetch()}
        empty={
          <div className={styles.empty}>
            <h2>{filtered ? t('editorial.noneFiltered') : t('editorial.noneTitle')}</h2>
            <p>{filtered ? t('editorial.noneFilteredBody') : t('editorial.noneBody')}</p>
          </div>
        }
      >
        <RefreshNotice query={list} what={t('editorial.title')} />
        <table className={styles.table} aria-label={t('editorial.title')}>
          <thead>
            <tr>
              <th scope="col">{t('editorial.table.package')}</th>
              <th scope="col">{t('editorial.table.stage')}</th>
              <th scope="col">{t('editorial.table.reviews')}</th>
              <th scope="col">{t('editorial.table.age')}</th>
              <th scope="col">{t('editorial.table.waiting')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => {
              const stageOf = caseStage(s)
              const waiting = waitingOn(stageOf)
              const days = ageDays(s.submitted_at, now)
              const assigned = (s.reviews ?? []).length
              return (
                <tr key={s.id}>
                  <th scope="row">
                    <Link to={`/editor/${s.id}`}>
                      <BidiText>{s.title}</BidiText>
                    </Link>
                    <div className={styles.meta}>
                      <span className="mono">{formatCode('SUB', s.id)}</span> · {t('editorial.table.version', { version: n(s.version_number) })}
                      {s.project?.id ? <> · <span className="mono">{formatCode('PRJ', s.project.id)}</span></> : null}
                      {s.project?.owner?.display_name ? <> · <BidiText>{s.project.owner.display_name}</BidiText></> : null}
                    </div>
                  </th>
                  <td>
                    <span className={styles.stage}>{t(`editorial.stages.${stageOf}`)}</span>
                  </td>
                  <td>{t('editorial.table.reviewsOf', { done: n(finishedReviews(s)), assigned: n(assigned) })}</td>
                  <td>{days === null ? '' : t('editorial.table.days', { count: days, formattedCount: n(days) })}{s.submitted_at ? <div className={styles.meta}>{date(s.submitted_at)}</div> : null}</td>
                  <td>{waiting ? t(`editorial.waiting.${waiting}`) : <span className={styles.meta}>{t('editorial.waiting.nobody')}</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {list.data?.pagination ? <Pagination pagination={{ ...list.data.pagination, per_page: QUEUE_PER_PAGE }} onPage={(p) => url.set({ page: p })} /> : null}
      </StateBoundary>
    </section>
  )
}
