import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { countApplications, countUsers, decideApplication, listApplications, type Decision } from '@/api/admin'
import { invalidate } from '@/api/invalidate'
import { qk } from '@/api/queryKeys'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { MutationNotice } from '@/components/MutationNotice'
import { Pagination } from '@/components/Pagination'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { useQueryParams } from '@/hooks/useQueryParams'
import { AdminHead, FilterChips } from './AdminHead'
import { ApplicationDetail } from './ApplicationDetail'
import { applicationCode, QUEUE_STATUSES } from './adminModel'
import styles from './Admin.module.css'

/** Screen 13, Applications: the queue of people asking for a researcher account, and the decision on each. */
export function ApplicationsPage() {
  const { t } = useTranslation()
  const { n, relative } = usePreferences()
  const qc = useQueryClient()
  const url = useQueryParams()

  const status = url.oneOf('status', QUEUE_STATUSES, 'pending')
  const selectedId = url.id('application')

  const list = useQuery({
    queryKey: qk.admin.applications({ status, page: url.page }),
    queryFn: ({ signal }) => listApplications({ status, page: url.page }, signal),
    placeholderData: keepPreviousData,
  })
  const counts = useQueries({
    queries: QUEUE_STATUSES.map((s) => ({ queryKey: qk.admin.count(`applications:${s}`), queryFn: ({ signal }: { signal: AbortSignal }) => countApplications(s, signal) })),
  })
  const unverified = useQuery({ queryKey: qk.admin.count('accounts:unverified'), queryFn: ({ signal }) => countUsers('unverified', signal) })

  const decide = useMutation({
    mutationFn: ({ id, decision, text }: { id: number; decision: Decision; text: string }) => decideApplication(id, decision, text),
    onSuccess: () => invalidate.adminApplicationsChanged(qc),
  })

  const items = list.data?.items ?? []
  const selected = items.find((a) => a.id === selectedId)
  const total = list.data?.pagination?.total_items ?? items.length
  const decidedOne = decide.data ? decide.variables : undefined

  return (
    <section>
      <AdminHead title={t('admin.applications.title')} subtitle={t('admin.applications.subtitle', { count: total, formattedCount: n(total) })} />

      <FilterChips
        label={t('admin.applications.filter')}
        value={status}
        onChange={(value) => url.set({ status: value, application: null })}
        items={QUEUE_STATUSES.map((s, i) => ({ value: s, label: t(`admin.applications.status.${s}`), count: counts[i]?.data === undefined ? undefined : n(counts[i]!.data!) }))}
      />

      {decide.isSuccess && decidedOne ? (
        <p className={styles.success} role="status">
          {t('admin.applications.done', { decision: t(`admin.applications.decision.${decidedOne.decision}`) })}
        </p>
      ) : null}
      <MutationNotice error={decide.error} title={t('admin.applications.failed')} />

      <StateBoundary
        state={viewStateOf(list, { isEmpty: (d) => (d as { items: unknown[] }).items.length === 0 })}
        errorValue={list.error}
        onRetry={() => void list.refetch()}
        empty={
          <div className={styles.empty}>
            <h2>{t(`admin.applications.empty.${status}.title`)}</h2>
            <p>{t(`admin.applications.empty.${status}.body`)}</p>
            {status === 'pending' && unverified.data ? (
              <p>{t('admin.applications.unverified', { count: unverified.data, formattedCount: n(unverified.data) })}</p>
            ) : null}
          </div>
        }
      >
        <div className={styles.split}>
          <div>
            <ul className={styles.queue} aria-label={t('admin.applications.list')}>
              {items.map((a) => (
                <li key={a.id}>
                  <button type="button" className={styles.queueItem} aria-current={a.id === selected?.id} onClick={() => url.set({ application: a.id }, { keepPage: true })}>
                    <strong>
                      <BidiText>{a.user.display_name}</BidiText>
                    </strong>
                    <span className={styles.code}>{applicationCode(a)}</span>
                    <span className={styles.hint}>
                      {a.created_at ? t('admin.applications.waiting', { when: relative(a.created_at) }) : ''}
                      {(a.replies?.length ?? 0) > 0 ? ` · ${t('admin.applications.hasReply')}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {list.data?.pagination ? <Pagination pagination={list.data.pagination} onPage={(page) => url.set({ page }, { keepPage: true })} /> : null}
          </div>
          {selected ? (
            <ApplicationDetail key={selected.id} application={selected} busy={decide.isPending} onDecide={(decision, text) => decide.mutate({ id: selected.id, decision, text })} />
          ) : (
            <p className={styles.hint}>{t('admin.applications.pick')}</p>
          )}
        </div>
      </StateBoundary>
    </section>
  )
}
