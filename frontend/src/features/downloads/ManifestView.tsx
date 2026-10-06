import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getExport, getManifest } from '@/api/exports'
import { usePreferences } from '@/app/preferencesContext'
import { NeutralState } from '@/components/Badges'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { formatCode } from '@/domain/codes'
import { exportCode, partChecksum, partIsReady, partSize, partsOf, splitBytes } from './downloadsModel'
import { useExportableProjects } from './useExportableProjects'
import styles from './Downloads.module.css'
import { qk } from '@/api/queryKeys'

/** What is in one package: the manifest the server wrote, and the parts with their checksums. */
export function ManifestView({ id, onBack }: { id: number; onBack: () => void }) {
  const { t } = useTranslation()
  const { n, date } = usePreferences()
  const { titles } = useExportableProjects()

  const manifest = useQuery({ queryKey: qk.exports.manifest(id), queryFn: ({ signal }) => getManifest(id, signal), retry: false })
  const job = useQuery({ queryKey: qk.exports.job(id), queryFn: ({ signal }) => getExport(id, signal), retry: false })

  // The manifest decides the view; the job (parts, expiry) fills in beside it when it arrives.
  const state = viewStateOf(manifest)
  const m = manifest.data
  const j = job.data
  const bytes = (value: number) => {
    const b = splitBytes(value)
    return t(`downloads.bytes.${b.unit}`, { value: n(b.value) })
  }

  const scope =
    j?.scope === 'account'
      ? t('downloads.job.scopeAccount')
      : j?.scope === 'project' && j.target_id
        ? t('downloads.job.scopeProject', { title: titles.get(j.target_id) ?? formatCode('PRJ', j.target_id) })
        : (m?.scope ?? '')
  const counts = Object.entries(m?.counts ?? {})
  const parts = j ? partsOf(j) : []

  return (
    <section>
      <Button variant="ghost" onClick={onBack}>
        {t('downloads.manifest.back')}
      </Button>
      <StateBoundary
        state={state}
        errorValue={manifest.error}
        onRetry={() => {
          void manifest.refetch()
          void job.refetch()
        }}
        forbidden={
          <div className={styles.notice}>
            <h2>{t('downloads.manifest.unavailable.title')}</h2>
            <p>{t('downloads.manifest.unavailable.body')}</p>
          </div>
        }
      >
        {m ? (
          <>
            <h1 className={styles.newTitle}>{t('downloads.manifest.title', { code: exportCode(id) })}</h1>
            <p className={styles.hint}>
              <BidiText>{scope}</BidiText>
            </p>

            <section className={styles.step} aria-label={t('downloads.manifest.metadata')}>
              <h2>{t('downloads.manifest.metadata')}</h2>
              <dl className={styles.facts}>
                <dt>{t('downloads.manifest.scope')}</dt>
                <dd>
                  <BidiText>{scope}</BidiText>
                </dd>
                <dt>{t('downloads.manifest.format')}</dt>
                <dd>{t('downloads.job.format')}</dd>
                <dt>{t('downloads.manifest.requestedBy')}</dt>
                <dd>{m.requester?.display_name ?? t('downloads.manifest.notRecorded')}</dd>
                <dt>{t('downloads.manifest.generated')}</dt>
                <dd>{m.created_at ? date(m.created_at, { time: true }) : t('downloads.manifest.notRecorded')}</dd>
                <dt>{t('downloads.manifest.corpusVersion')}</dt>
                <dd>{m.corpus_version ?? <NeutralState kind="unknown">{t('downloads.manifest.notRecorded')}</NeutralState>}</dd>
                {j?.expires_at ? (
                  <>
                    <dt>{t('downloads.manifest.expires')}</dt>
                    <dd>{date(j.expires_at)}</dd>
                  </>
                ) : null}
              </dl>
            </section>

            <section className={styles.step} aria-label={t('downloads.manifest.included')}>
              <h2>{t('downloads.manifest.included')}</h2>
              {counts.length > 0 ? (
                <dl className={styles.facts}>
                  {counts.map(([k, v]) => (
                    <div key={k} className={styles.countRow}>
                      <dt>{k}</dt>
                      <dd>{typeof v === 'number' ? n(v) : v}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className={styles.hint}>{t('downloads.manifest.countsNone')}</p>
              )}
              <h3 className={styles.exTitle}>{t('downloads.manifest.files')}</h3>
              <ul className={styles.plain}>
                {(m.files ?? []).map((f) => (
                  <li key={f} className="mono">
                    {f}
                  </li>
                ))}
              </ul>
            </section>

            <section className={styles.step} aria-label={t('downloads.manifest.parts')}>
              <h2>{t('downloads.manifest.parts')}</h2>
              {parts.length === 0 ? <p className={styles.hint}>{t('downloads.manifest.partsNone')}</p> : null}
              <ul className={styles.plain}>
                {parts.map((p, i) => (
                  <li key={p.name + i} className={styles.partRow}>
                    <span className="mono">{p.name}</span>
                    <span>{partIsReady(p) ? t('downloads.state.complete') : t(`downloads.state.${p.status === 'failed' ? 'failed' : 'unknown'}`)}</span>
                    {partSize(p) !== null ? <span>{bytes(partSize(p)!)}</span> : null}
                    <span className="mono">{partChecksum(p) ?? '—'}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className={styles.step} aria-label={t('downloads.manifest.exclusions')}>
              <h2>{t('downloads.manifest.exclusions')}</h2>
              {(m.exclusions ?? []).length === 0 ? (
                <p className={styles.hint}>{t('downloads.manifest.exclusionsNone')}</p>
              ) : (
                <ul className={styles.plain}>
                  {(m.exclusions ?? []).map((x, i) => (
                    <li key={i}>
                      <strong>{x.kind}</strong> {x.what} <span className={styles.hint}>{x.why}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </StateBoundary>
    </section>
  )
}
