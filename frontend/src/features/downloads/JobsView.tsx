import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { cancelExport, downloadFile, getQuota, listExports, partPath, projectDownloadPath } from '@/api/exports'
import type { ExportJob } from '@/api/schemas/exports'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { Pagination } from '@/components/Pagination'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { formatCode } from '@/domain/codes'
import {
  daysUntil,
  exportCode,
  isActive,
  jobState,
  partChecksum,
  partId,
  partIsBlocked,
  partIsReady,
  partSize,
  partsOf,
  splitBytes,
} from './downloadsModel'
import { useExportableProjects } from './useExportableProjects'
import styles from './Downloads.module.css'
import { qk } from '@/api/queryKeys'
import { invalidate } from '@/api/invalidate'
import { MutationNotice } from '@/components/MutationNotice'

interface Props {
  notice: string | null
  page: number
  onPage: (page: number) => void
  onNew: () => void
  onManifest: (id: number) => void
  onAgain: (job: ExportJob) => void
}

export function JobsView({ notice, page, onPage, onNew, onManifest, onAgain }: Props) {
  const { t } = useTranslation()
  const { n, date, relative } = usePreferences()
  const qc = useQueryClient()
  const { titles } = useExportableProjects()

  const list = useQuery({
    queryKey: qk.exports.list(page),
    queryFn: ({ signal }) => listExports(page, signal),
    // Running exports are followed until they finish, even if the researcher leaves the tab open.
    refetchInterval: (q) => (q.state.data?.items.some(isActive) ? 3000 : false),
  })
  const quota = useQuery({ queryKey: qk.exports.quota, queryFn: ({ signal }) => getQuota(signal) })

  const bytes = (value: number) => {
    const b = splitBytes(value)
    return t(`downloads.bytes.${b.unit}`, { value: n(b.value) })
  }

  const cancel = useMutation({
    mutationFn: (id: number) => cancelExport(id),
    onSuccess: () => invalidate.exportsChanged(qc),
  })

  // The file is fetched with the sign-in token, so it is a mutation like any other request: its pending state is the
  // button's busy state and its error is shown as it came.
  const download = useMutation({
    mutationFn: ({ path, name }: { key: string; path: string; name: string }) => downloadFile(path, name),
  })
  const busy = download.isPending ? download.variables.key : null

  const now = list.dataUpdatedAt
  const items = list.data?.items ?? []
  const total = list.data?.pagination?.total_items ?? items.length
  const running = items.filter((j) => j.status === 'running').length
  const queued = items.filter((j) => j.status === 'queued').length
  const state = viewStateOf(list, { isEmpty: (d) => (d as { items: unknown[] }).items.length === 0 })
  const blocked = items.some((j) => partsOf(j).some(partIsBlocked))

  const scopeLabel = (job: ExportJob) => {
    if (job.scope === 'account') return t('downloads.job.scopeAccount')
    if (job.scope === 'project') {
      const title = job.target_id ? titles.get(job.target_id) : undefined
      return t('downloads.job.scopeProject', { title: title ?? (job.target_id ? formatCode('PRJ', job.target_id) : '') })
    }
    return t('downloads.job.scopeOther', { scope: job.scope })
  }

  return (
    <section>
      <div className={styles.pageHead}>
        <div>
          <h1>{t('downloads.title')}</h1>
          {list.data ? (
            <p className={styles.hint}>
              {t('downloads.activeLine', {
                count: t('downloads.count', { count: total, formattedCount: n(total) }),
                running: n(running),
                queued: n(queued),
              })}
            </p>
          ) : null}
        </div>
        <Button variant="primary" onClick={onNew}>
          {t('downloads.newExport')}
        </Button>
      </div>

      {notice ? (
        <p role="status" className={styles.success}>
          {notice}
        </p>
      ) : null}

      <section className={styles.storage} aria-label={t('downloads.storage.heading')}>
        <div className={styles.storageHead}>
          <strong>{t('downloads.storage.heading')}</strong>
          {quota.data ? (
            <span>{t('downloads.storage.used', { used: bytes(quota.data.used_bytes), limit: bytes(quota.data.limit_bytes) })}</span>
          ) : null}
        </div>
        {quota.data ? (
          <>
            <div
              className={styles.bar}
              role="progressbar"
              aria-label={t('downloads.storage.heading')}
              aria-valuemin={0}
              aria-valuemax={quota.data.limit_bytes}
              aria-valuenow={quota.data.used_bytes}
            >
              <span
                className={styles.barFill}
                style={{ inlineSize: `${Math.min(100, (quota.data.used_bytes / Math.max(1, quota.data.limit_bytes)) * 100)}%` }}
              />
            </div>
            <p className={styles.hint}>
              {t('downloads.storage.running', { running: n(quota.data.concurrent_jobs), limit: n(quota.data.concurrent_limit) })}
            </p>
          </>
        ) : null}
        {quota.isError ? <p className={styles.hint}>{t('downloads.storage.loadFailed')}</p> : null}
        <p className={styles.hint}>{t('downloads.storage.note')}</p>
      </section>

      {blocked ? (
        <div className={styles.banner} role="alert">
          <h2>{t('downloads.blocked.title')}</h2>
          <p>{t('downloads.blocked.body')}</p>
        </div>
      ) : null}

      <MutationNotice error={download.error} title={t('downloads.download.failed')} />
      <MutationNotice error={cancel.error} title={t('downloads.download.cancelFailed')} />

      <StateBoundary
        state={state}
        errorValue={list.error}
        forbidden={
          <div className={styles.notice}>
            <h2>{t('downloads.forbidden.title')}</h2>
            <p>{t('downloads.forbidden.body')}</p>
          </div>
        }
        error={
          <div className={styles.banner} role="alert">
            <h2>{t('downloads.loadFailed.title')}</h2>
            <p>{t('downloads.loadFailed.body')}</p>
            <Button onClick={() => void list.refetch()}>{t('common.retry')}</Button>
          </div>
        }
        empty={
          <div className={styles.empty}>
            <h2>{t('downloads.empty.title')}</h2>
            <p>{t('downloads.empty.prompt')}</p>
            <ul className={styles.scopes}>
              {(['account', 'projects', 'later'] as const).map((k) => (
                <li key={k}>
                  <strong>{t(`downloads.empty.${k}`)}</strong> {t(`downloads.empty.${k}Body`)}
                </li>
              ))}
            </ul>
            <p className={styles.hint}>{t('downloads.empty.note')}</p>
            <Button variant="primary" onClick={onNew}>
              {t('downloads.empty.start')}
            </Button>
          </div>
        }
      >
        <ul className={styles.jobs}>
          {items.map((job) => {
            const js = jobState(job, now)
            const parts = partsOf(job)
            const days = daysUntil(job.expires_at, now)
            const canDownload = js === 'complete' || js === 'partial'
            return (
              <li key={job.id} className={styles.job}>
                <div className={styles.jobTop}>
                  <span className={[styles.badge, js === 'failed' ? styles.badgeBad : '', js === 'queued' || js === 'running' ? styles.badgeActive : ''].join(' ')}>
                    {t(`downloads.state.${js}`)}
                  </span>
                  <span className="mono">{exportCode(job.id)}</span>
                </div>
                <h2 className={styles.jobTitle}>
                  <BidiText>{scopeLabel(job)}</BidiText>
                </h2>
                <p className={styles.hint}>{t('downloads.job.format')}</p>

                {isActive(job) ? (
                  <p>
                    {job.progress ?? ''} <span className={styles.hint}>{t('downloads.job.keepsRunning')}</span>
                  </p>
                ) : null}
                {js === 'failed' ? (
                  <p className={styles.bad}>
                    {job.failure_reason ? t('downloads.job.failedReason', { reason: job.failure_reason }) : t('downloads.job.failedNoReason')}
                  </p>
                ) : null}
                {js === 'cancelled' ? <p className={styles.hint}>{t('downloads.job.cancelledNote')}</p> : null}
                {js === 'expired' ? <p className={styles.hint}>{t('downloads.job.expiredNote')}</p> : null}
                {js === 'partial' ? <p className={styles.bad}>{t('downloads.job.partialNote')}</p> : null}

                <p className={styles.meta}>
                  {job.created_at ? t(canDownload || js === 'expired' ? 'downloads.job.generated' : 'downloads.job.requested', { when: relative(job.created_at) }) : ''}
                  {job.file_size ? ` · ${bytes(job.file_size)}` : ''}
                  {js === 'complete' && job.expires_at && days !== null
                    ? ` · ${days > 1 ? t('downloads.job.expiresIn', { count: days, formattedCount: n(days) }) : t('downloads.job.expires', { date: date(job.expires_at) })}`
                    : ''}
                  {js === 'expired' && job.expires_at ? ` · ${t('downloads.job.expired', { date: date(job.expires_at) })}` : ''}
                </p>

                {canDownload && parts.length > 0 ? (
                  <ul className={styles.parts}>
                    {parts.map((p, i) => {
                      const pid = partId(p, i)
                      const label = partIsReady(p)
                        ? t('downloads.job.partLabel', { n: n(i + 1), size: partSize(p) !== null ? bytes(partSize(p)!) : '' })
                        : partIsBlocked(p)
                          ? t('downloads.job.partBlocked', { n: n(i + 1) })
                          : t('downloads.job.partFailed', { n: n(i + 1) })
                      return (
                        <li key={pid}>
                          <span className={partIsReady(p) ? '' : styles.bad}>{label}</span>
                          {partChecksum(p) ? <span className={styles.hint}> · {partChecksum(p)!.slice(0, 8)}</span> : null}
                          {partIsReady(p) ? (
                            <Button
                              disabled={busy !== null}
                              onClick={() => download.mutate({ key: `${job.id}:${pid}`, path: partPath(job.id, pid), name: p.name })}
                              aria-label={`${t('downloads.job.downloadPart', { n: n(i + 1) })} ${exportCode(job.id)}`}
                            >
                              {busy === `${job.id}:${pid}` ? '…' : t('downloads.job.download')}
                            </Button>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
                {canDownload && parts.length === 0 ? (
                  job.scope === 'project' && job.target_id ? (
                    <div className={styles.actions}>
                      <Button
                        disabled={busy !== null}
                        onClick={() => download.mutate({ key: `${job.id}`, path: projectDownloadPath(job.target_id!, job.id), name: `export_${job.id}` })}
                      >
                        {t('downloads.job.download')}
                      </Button>
                    </div>
                  ) : (
                    <p className={styles.hint}>{t('downloads.job.noParts')}</p>
                  )
                ) : null}

                <div className={styles.actions}>
                  {isActive(job) ? (
                    <Button disabled={cancel.isPending} onClick={() => cancel.mutate(job.id)}>
                      {cancel.isPending && cancel.variables === job.id ? t('downloads.job.cancelling') : t('downloads.job.cancel')}
                    </Button>
                  ) : null}
                  {canDownload ? (
                    <Button variant="ghost" onClick={() => onManifest(job.id)}>
                      {t('downloads.job.manifest')}
                    </Button>
                  ) : null}
                  {(js === 'expired' || js === 'cancelled' || js === 'failed' || js === 'partial') && (job.scope === 'account' || job.target_id) ? (
                    <Button onClick={() => onAgain(job)}>{t('downloads.job.again')}</Button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
        {list.data?.pagination ? <Pagination pagination={list.data.pagination} onPage={onPage} /> : null}
      </StateBoundary>
    </section>
  )
}
