import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { getOps, listJobs } from '@/api/admin'
import { qk } from '@/api/queryKeys'
import { usePreferences } from '@/app/preferencesContext'
import { NeutralState } from '@/components/Badges'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { formatCode } from '@/domain/codes'
import { AdminHead } from './AdminHead'
import { humanBytes } from './adminModel'
import styles from './Admin.module.css'

const REFRESH_MS = 60_000
/** What the design's dashboard shows that the server does not report. They are listed so they are not mistaken for healthy. */
const NOT_REPORTED = ['indexing', 'latency', 'errors', 'backup', 'completeness'] as const

/** Screen 13, Operations: counts, timings and job ids only. Investigating a failure never needs private research. */
export function OperationsPage() {
  const { t } = useTranslation()
  const { n, date } = usePreferences()

  const ops = useQuery({ queryKey: qk.admin.ops, queryFn: ({ signal }) => getOps(signal), refetchInterval: REFRESH_MS })
  const failed = useQuery({
    queryKey: qk.admin.jobs({ status: 'failed', page: 1 }),
    queryFn: ({ signal }) => listJobs({ status: 'failed' }, signal),
    refetchInterval: REFRESH_MS,
  })

  const data = ops.data
  const storage = data ? humanBytes(data.storage_used_bytes) : null

  return (
    <section>
      <AdminHead
        title={t('admin.ops.title')}
        subtitle={ops.dataUpdatedAt ? t('admin.ops.updated', { when: date(new Date(ops.dataUpdatedAt), { time: true }) }) : t('admin.ops.subtitle')}
      />

      <StateBoundary state={viewStateOf(ops)} errorValue={ops.error} onRetry={() => void ops.refetch()}>
        {data ? (
          <>
            {data.active_alerts.length > 0 ? (
              <ul className={styles.thread} aria-label={t('admin.ops.alerts')}>
                {data.active_alerts.map((a, i) => (
                  <li key={i} role={a.severity === 'warning' ? 'alert' : 'status'}>
                    <strong>{t(`admin.ops.severity.${a.severity}`, { defaultValue: a.severity })}</strong> · {a.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.hint}>{t('admin.ops.noAlerts')}</p>
            )}

            <ul className={styles.cards}>
              <li className={styles.card}>
                <span className={styles.hint}>{t('admin.ops.queue')}</span>
                <strong>{n(data.queue_depth)}</strong>
                <span className={styles.hint}>{t('admin.ops.queueNote')}</span>
              </li>
              <li className={[styles.card, data.failures_count > 0 ? styles.flagged : ''].join(' ')}>
                <span className={styles.hint}>{t('admin.ops.failures')}</span>
                <strong>{n(data.failures_count)}</strong>
                <span className={styles.hint}>{data.failures_count > 0 ? t('admin.ops.needsReview') : t('admin.ops.noFailures')}</span>
              </li>
              <li className={styles.card}>
                <span className={styles.hint}>{t('admin.ops.storage')}</span>
                <strong>{storage ? t('admin.ops.size', { value: n(storage.value), unit: t(`admin.ops.units.${storage.unit}`) }) : '—'}</strong>
                <span className={styles.hint}>{t('admin.ops.storageNote')}</span>
              </li>
            </ul>
          </>
        ) : null}
      </StateBoundary>

      <section className={styles.section} aria-label={t('admin.ops.failedJobs')}>
        <h2>{t('admin.ops.failedJobs')}</h2>
        {failed.isError ? <p role="alert">{t('admin.ops.failedLoad')}</p> : null}
        {failed.data && failed.data.items.length === 0 ? <p className={styles.hint}>{t('admin.ops.noFailedJobs')}</p> : null}
        <ul className={styles.thread}>
          {(failed.data?.items ?? []).slice(0, 5).map((j) => (
            <li key={j.id}>
              <span className={styles.code}>{formatCode('EXP', j.id)}</span> · {j.scope ?? '—'}
              {j.failure_reason ? ` · ${j.failure_reason}` : ''}
            </li>
          ))}
        </ul>
        <p className={styles.hint}>
          <Link to="/admin/limits?jobs=failed">{t('admin.ops.allJobs')}</Link>
        </p>
      </section>

      <section className={styles.section} aria-label={t('admin.ops.notReported')}>
        <h2>{t('admin.ops.notReported')}</h2>
        <ul className={styles.chips}>
          {NOT_REPORTED.map((k) => (
            <li key={k}>
              <NeutralState kind="unknown">{t(`admin.ops.missing.${k}`)}</NeutralState>
            </li>
          ))}
        </ul>
      </section>

      <p className={styles.hint}>{t('admin.ops.counts')}</p>
    </section>
  )
}
