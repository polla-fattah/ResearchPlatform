import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getLimits, listJobs } from '@/api/admin'
import { qk } from '@/api/queryKeys'
import { usePreferences } from '@/app/preferencesContext'
import { NeutralState } from '@/components/Badges'
import { Pagination } from '@/components/Pagination'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { useQueryParams } from '@/hooks/useQueryParams'
import { formatCode } from '@/domain/codes'
import { AdminHead, FilterChips } from './AdminHead'
import { LIMIT_GROUPS, ungroupedLimits } from './adminModel'
import styles from './Admin.module.css'

const JOB_STATUSES = ['', 'failed', 'queued', 'running', 'completed', 'cancelled'] as const

/**
 * Screen 13, Limits, quotas and jobs. The limits are shown as the server reports them and cannot be changed here:
 * the server stores a limit but nothing applies it, so an edit would look like it did something and do nothing
 * (request file C-20). Jobs are the export jobs; a failed one is shown for diagnosis, and no retry is offered because
 * the server's retry queues a job that nothing runs (C-17).
 */
export function LimitsPage() {
  const { t } = useTranslation()
  const { n, date } = usePreferences()
  const url = useQueryParams()
  const status = url.oneOf('jobs', JOB_STATUSES, '')

  const limits = useQuery({ queryKey: qk.admin.limits, queryFn: ({ signal }) => getLimits(signal) })
  const jobs = useQuery({
    queryKey: qk.admin.jobs({ status, page: url.page }),
    queryFn: ({ signal }) => listJobs({ status: status || undefined, page: url.page }, signal),
    placeholderData: keepPreviousData,
  })

  const value = (key: string, v: unknown) =>
    typeof v === 'number' ? t(`admin.limits.units.${key}`, { value: n(v), defaultValue: String(n(v)) }) : v === null || v === undefined ? '—' : String(v)

  return (
    <section>
      <AdminHead title={t('admin.limits.title')} subtitle={t('admin.limits.subtitle')} />

      <section className={styles.section} aria-label={t('admin.limits.policies')}>
        <h2>{t('admin.limits.policies')}</h2>
        <p className={styles.notice} role="note">
          {t('admin.limits.notApplied')}
        </p>
        <StateBoundary state={viewStateOf(limits)} errorValue={limits.error} onRetry={() => void limits.refetch()}>
          {limits.data ? (
            <>
              {LIMIT_GROUPS.map((g) => (
                <div key={g.id}>
                  <h3>{t(`admin.limits.groups.${g.id}`)}</h3>
                  <dl className={styles.facts}>
                    {g.keys
                      .filter((k) => k in limits.data!)
                      .map((k) => (
                        <div key={k} className={styles.fact}>
                          <dt>{t(`admin.limits.names.${k}`, { defaultValue: k })}</dt>
                          <dd>{value(k, limits.data![k])}</dd>
                        </div>
                      ))}
                  </dl>
                </div>
              ))}
              {ungroupedLimits(limits.data).length > 0 ? (
                <div>
                  <h3>{t('admin.limits.groups.other')}</h3>
                  <dl className={styles.facts}>
                    {ungroupedLimits(limits.data).map((k) => (
                      <div key={k} className={styles.fact}>
                        <dt>{k}</dt>
                        <dd>{value(k, limits.data![k])}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}
              <h3>{t('admin.limits.groups.types')}</h3>
              <dl className={styles.facts}>
                <dt>{t('admin.limits.uploads')}</dt>
                <dd>{t('admin.limits.uploadsValue')}</dd>
                <dt>{t('admin.limits.exports')}</dt>
                <dd>{t('admin.limits.exportsValue')}</dd>
              </dl>
              <h3>{t('admin.limits.groups.reports')}</h3>
              <p>
                <NeutralState kind="unknown">{t('admin.limits.reportsNone')}</NeutralState>
              </p>
            </>
          ) : null}
        </StateBoundary>
      </section>

      <section className={styles.section} aria-label={t('admin.limits.jobs')}>
        <h2>{t('admin.limits.jobs')}</h2>
        <p className={styles.hint}>{t('admin.limits.jobsNote')}</p>
        <FilterChips
          label={t('admin.limits.jobsFilter')}
          value={status}
          onChange={(value) => url.set({ jobs: value })}
          items={JOB_STATUSES.map((s) => ({ value: s, label: t(`admin.limits.jobStatus.${s || 'all'}`) }))}
        />
        <StateBoundary
          state={viewStateOf(jobs, { isEmpty: (d) => (d as { items: unknown[] }).items.length === 0 })}
          errorValue={jobs.error}
          onRetry={() => void jobs.refetch()}
          empty={
            <div className={styles.empty}>
              <h2>{t('admin.limits.noJobs.title')}</h2>
              <p>{t('admin.limits.noJobs.body')}</p>
            </div>
          }
        >
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('admin.limits.job')}</th>
                <th scope="col">{t('admin.limits.jobScope')}</th>
                <th scope="col">{t('admin.limits.jobState')}</th>
                <th scope="col">{t('admin.limits.jobWhen')}</th>
              </tr>
            </thead>
            <tbody>
              {(jobs.data?.items ?? []).map((j) => (
                <tr key={j.id}>
                  <th scope="row" className={styles.code}>
                    {formatCode('EXP', j.id)}
                  </th>
                  <td>{j.scope ?? '—'}</td>
                  <td>
                    {t(`admin.limits.jobStatus.${j.status}`, { defaultValue: j.status })}
                    {j.failure_reason ? <div className={styles.hint}>{j.failure_reason}</div> : null}
                    {j.progress ? <div className={styles.hint}>{j.progress}</div> : null}
                  </td>
                  <td>{j.created_at ? date(j.created_at, { time: true }) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {jobs.data?.pagination ? <Pagination pagination={jobs.data.pagination} onPage={(page) => url.set({ page }, { keepPage: true })} /> : null}
        </StateBoundary>
        <p className={styles.hint}>{t('admin.limits.diagnosticOnly')}</p>
      </section>
    </section>
  )
}
