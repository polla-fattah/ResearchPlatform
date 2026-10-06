import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/api/errors'
import { createExport, getQuota, previewExport, type ExportRequest } from '@/api/exports'
import type { ExportJob } from '@/api/schemas/exports'
import { usePreferences } from '@/app/preferencesContext'
import { NeutralState } from '@/components/Badges'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { formatCode } from '@/domain/codes'
import { useDebounced } from '../picker/useDebounced'
import { splitBytes } from './downloadsModel'
import { useExportableProjects } from './useExportableProjects'
import styles from './Downloads.module.css'
import { qk } from '@/api/queryKeys'
import { MutationNotice } from '@/components/MutationNotice'

interface Props {
  /** Pre-filled when an expired or cancelled export is started again. */
  initial?: { scope: 'account' | 'projects'; projectIds: number[] }
  onBack: () => void
  onStarted: (job: ExportJob) => void
}

const COUNT_KEYS = ['projects', 'resources', 'evidence_items', 'documents'] as const

export function NewExportView({ initial, onBack, onStarted }: Props) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const { projects, isPending: projectsPending, isError: projectsError } = useExportableProjects()
  const [scope, setScope] = useState<'account' | 'projects'>(initial?.scope ?? 'account')
  const [picked, setPicked] = useState<number[]>(initial?.projectIds ?? [])
  const [library, setLibrary] = useState(false)
  // One key for this attempt: a second click, or a retry after a dropped connection, cannot start a second export.
  const [key] = useState(() => crypto.randomUUID())

  const request: ExportRequest | null =
    scope === 'account'
      ? { scope: 'account' }
      : picked.length > 0
        ? { scope: 'project', project_ids: picked, include_personal_library: library || undefined }
        : null
  const settled = useDebounced(request, 300)

  const preview = useQuery({
    queryKey: qk.exports.preview(settled ?? { scope: 'account' }),
    queryFn: ({ signal }) => previewExport(settled!, signal),
    enabled: settled !== null,
  })
  const quota = useQuery({ queryKey: qk.exports.quota, queryFn: ({ signal }) => getQuota(signal) })

  const start = useMutation({
    mutationFn: () => createExport(request!, key),
    onSuccess: (job) => onStarted(job),
  })

  const bytes = (value: number) => {
    const b = splitBytes(value)
    return t(`downloads.bytes.${b.unit}`, { value: n(b.value) })
  }
  const toggle = (id: number) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  const remaining = quota.data ? quota.data.limit_bytes - quota.data.used_bytes : null
  const estimate = preview.data?.estimated_size_bytes ?? null
  const overQuota = estimate !== null && remaining !== null && estimate > remaining
  const limitHit = start.error instanceof ApiError && start.error.code === 'LIMIT_EXCEEDED'
  const includesLibrary = scope === 'account' || library

  return (
    <section>
      <Button variant="ghost" onClick={onBack}>
        {t('downloads.new.back')}
      </Button>
      <h1 className={styles.newTitle}>{t('downloads.new.title')}</h1>

      <fieldset className={styles.step}>
        <legend>{t('downloads.new.scope')}</legend>
        <label className={styles.choice}>
          <input type="radio" name="scope" checked={scope === 'account'} onChange={() => setScope('account')} />
          <span>
            {t('downloads.new.scopeAccount')}
            <small>{t('downloads.new.scopeAccountSub')}</small>
          </span>
        </label>
        <label className={styles.choice}>
          <input type="radio" name="scope" checked={scope === 'projects'} onChange={() => setScope('projects')} />
          <span>
            {t('downloads.new.scopeProjects')}
            <small>{t('downloads.new.scopeProjectsSub')}</small>
          </span>
        </label>
        {(['scopeResources', 'scopeDocument'] as const).map((k) => (
          <label key={k} className={[styles.choice, styles.choiceOff].join(' ')}>
            <input type="radio" name="scope" disabled />
            <span>
              {t(`downloads.new.${k}`)}
              <small>{t('downloads.new.scopeLater')}</small>
            </span>
          </label>
        ))}

        {scope === 'projects' ? (
          <div className={styles.projects}>
            <h2>{t('downloads.new.projectsHeading')}</h2>
            {projectsError ? <p role="alert">{t('downloads.new.projectsFailed')}</p> : null}
            {!projectsPending && projects.length === 0 && !projectsError ? <p className={styles.hint}>{t('downloads.new.noProjects')}</p> : null}
            {projects.map((p) => (
              <label key={p.id} className={styles.choice}>
                <input type="checkbox" checked={picked.includes(p.id)} onChange={() => toggle(p.id)} />
                <span>
                  <BidiText>{p.title}</BidiText>
                  <small className="mono">{formatCode('PRJ', p.id)}</small>
                </span>
              </label>
            ))}
            <label className={styles.choice}>
              <input type="checkbox" checked={library} onChange={(e) => setLibrary(e.target.checked)} />
              <span>{t('downloads.new.includeLibrary')}</span>
            </label>
            {picked.length === 0 ? <p className={styles.hint}>{t('downloads.new.pickProject')}</p> : null}
          </div>
        ) : null}
      </fieldset>

      <fieldset className={styles.step}>
        <legend>{t('downloads.new.formats')}</legend>
        <label className={styles.choice}>
          <input type="checkbox" checked disabled />
          <span>
            {t('downloads.new.formatZip')}
            <small>{t('downloads.new.formatZipSub')}</small>
          </span>
        </label>
        <p className={styles.hint}>{t('downloads.new.formatLater')}</p>
        <p className={styles.hint}>{t('downloads.new.formatsNote')}</p>
      </fieldset>

      <section className={styles.step} aria-label={t('downloads.new.preview')}>
        <h2>{t('downloads.new.preview')}</h2>
        {request === null ? <p className={styles.hint}>{t('downloads.new.pickProject')}</p> : null}
        {request !== null && preview.isPending ? <p role="status">{t('downloads.new.previewLoading')}</p> : null}
        {preview.isError ? <p role="alert">{t('downloads.new.previewFailed')}</p> : null}
        {preview.data ? (
          <>
            <dl className={styles.counts}>
              <dt className={styles.countHead}>🔒 {t('downloads.new.personal')}</dt>
              <dd>{includesLibrary ? t('downloads.new.personalLine') : <NeutralState kind="unknown">—</NeutralState>}</dd>
              <dt className={styles.countHead}>{t('downloads.new.project')}</dt>
              <dd />
              {COUNT_KEYS.map((k) => (
                <div key={k} className={styles.countRow}>
                  <dt>{t(`downloads.new.counts.${k}`)}</dt>
                  <dd>{n(preview.data.counts[k] ?? 0)}</dd>
                </div>
              ))}
            </dl>
            <p>{t('downloads.new.estimate', { size: bytes(preview.data.estimated_size_bytes) })}</p>
          </>
        ) : null}
        <h3 className={styles.exTitle}>{t('downloads.new.excluded')}</h3>
        <p className={styles.hint}>{t('downloads.new.excludedText')}</p>
        <p className={styles.hint}>{t('downloads.new.rightsNote')}</p>
        {overQuota && remaining !== null ? (
          <p role="alert" className={styles.bad}>
            {t('downloads.new.overQuota', { remaining: bytes(Math.max(0, remaining)) })}
          </p>
        ) : null}
      </section>

      {limitHit && quota.data ? (
        <p role="alert" className={styles.bad}>
          <strong>{t('downloads.new.failed')}. </strong>
          {t('downloads.new.limit', { limit: n(quota.data.concurrent_limit) })}
        </p>
      ) : (
        <MutationNotice error={start.error} title={t('downloads.new.failed')} />
      )}

      <div className={styles.actions}>
        <Button onClick={onBack} disabled={start.isPending}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" disabled={request === null || start.isPending || overQuota} onClick={() => start.mutate()}>
          {start.isPending ? t('downloads.new.starting') : t('downloads.new.start')}
        </Button>
      </div>
    </section>
  )
}
