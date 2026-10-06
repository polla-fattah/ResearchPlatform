import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { evidenceKeys, getDependencies, getEvidence } from '@/api/evidence'
import { usePreferences } from '@/app/preferencesContext'
import { NeutralState, ProvenanceTag, VisibilityBadge } from '@/components/Badges'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { AnnotationsPanel } from './AnnotationsPanel'
import { CorpusTabs } from './CorpusTabs'
import { CorrectionDialog, RemoveDialog } from './EvidenceDialogs'
import { correctionTarget, evidenceCode, hadithIdOf } from './evidenceModel'
import { FindingsPanel } from './FindingsPanel'
import { StateBadge } from './StateBadge'
import { StatePanel } from './StatePanel'
import styles from './Evidence.module.css'

interface Props {
  projectId: number
  id: number
  canEdit: boolean
  canAnnotate: boolean
  onRemoved: () => void
}

export function Inspector({ projectId, id, canEdit, canAnnotate, onRemoved }: Props) {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const [stateTarget, setStateTarget] = useState<string | null>(null)
  const [dialog, setDialog] = useState<null | 'correction' | 'remove'>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const detail = useQuery({
    queryKey: evidenceKeys.item(projectId, id),
    queryFn: ({ signal }) => getEvidence(projectId, id, signal),
  })
  const deps = useQuery({
    queryKey: evidenceKeys.deps(projectId, id),
    queryFn: ({ signal }) => getDependencies(projectId, id, signal),
  })

  const state = viewStateOf(detail)
  const item = detail.data
  const code = evidenceCode(id)

  return (
    <StateBoundary
      state={state}
      errorValue={detail.error}
      onRetry={() => void detail.refetch()}
      forbidden={
        <div className={styles.notice} role="status">
          <h2>{t('evidence.unavailable.title')}</h2>
          <p>{t('evidence.unavailable.body')}</p>
        </div>
      }
    >
      {item ? (
        <article className={styles.inspector} aria-label={code}>
          {notice ? (
            <p role="status" className={styles.success}>
              {notice}
            </p>
          ) : null}

          <header className={styles.inspHead}>
            <div className={styles.kickerRow}>
              <span className="mono">
                {t('evidence.inspector.kicker', { code, who: item.collector?.display_name ?? t('evidence.inspector.unknownCollector') })}
              </span>
              <StateBadge state={item.state} />
              <VisibilityBadge visibility="project" />
            </div>
            <h2>
              <BidiText>{item.resource?.title ?? code}</BidiText>
            </h2>
            <Button disabled title={t('release.notYet', { release: 'R1b' })}>
              {t('evidence.inspector.openSource')}
            </Button>
          </header>

          <CorpusTabs hadithId={hadithIdOf(item.resource)} />

          <section className={styles.source} aria-label={t('evidence.inspector.source')}>
            <p className={styles.sourceHead}>
              <ProvenanceTag kind="source" />
              <span className={styles.hint}>{t('evidence.inspector.direction')}</span>
            </p>
            <p className={styles.capturedText}>
              <BidiText>{item.captured_text}</BidiText>
            </p>
            <p className={styles.hint}>{t('evidence.inspector.normalizedUnavailable')}</p>
          </section>

          <section className={styles.section} aria-label={t('evidence.inspector.locatorHeading')}>
            <h3>{t('evidence.inspector.locatorHeading')}</h3>
            {!item.locator ? (
              <div className={styles.mergeNote}>
                <strong>{t('evidence.inspector.incompleteTitle')}</strong>
                <p>{t('evidence.inspector.incompleteBody')}</p>
              </div>
            ) : null}
            <dl className={styles.facts}>
              <dt>{t('evidence.inspector.locator')}</dt>
              <dd>
                {item.locator ? <BidiText>{item.locator}</BidiText> : <NeutralState kind="unknown">{t('evidence.inspector.notRecorded')}</NeutralState>}
              </dd>
              <dt>{t('evidence.inspector.version')}</dt>
              <dd>{item.source_version ?? <NeutralState kind="unknown">{t('evidence.inspector.notRecorded')}</NeutralState>}</dd>
              <dt>{t('evidence.inspector.record')}</dt>
              <dd className="mono">{correctionTarget(item.resource)?.code ?? '—'}</dd>
              <dt>{t('evidence.inspector.collected')}</dt>
              <dd>{item.created_at ? date(item.created_at, { time: true }) : '—'}</dd>
              <dt>{t('evidence.inspector.fingerprint')}</dt>
              <dd className="mono">{item.content_hash ? item.content_hash.slice(0, 12) : '—'}</dd>
              <dt>{t('evidence.inspector.origin')}</dt>
              <dd>
                <NeutralState kind="unknown">{t('evidence.inspector.originUnavailable')}</NeutralState>
              </dd>
            </dl>
          </section>

          <StatePanel
            projectId={projectId}
            item={item}
            findingsCount={deps.data?.findings.length ?? 0}
            canEdit={canEdit}
            target={stateTarget}
            onTarget={setStateTarget}
          />

          <AnnotationsPanel
            projectId={projectId}
            evidenceId={id}
            annotations={item.annotations ?? []}
            canAnnotate={canAnnotate}
          />

          <FindingsPanel
            projectId={projectId}
            evidenceId={id}
            deps={deps.data}
            depsFailed={deps.isError}
            canEdit={canEdit}
          />

          <div className={styles.actions}>
            <Button onClick={() => setDialog('correction')}>{t('evidence.inspector.proposeCorrection')}</Button>
            {canEdit ? (
              <Button variant="danger" onClick={() => setDialog('remove')}>
                {t('evidence.inspector.remove')}
              </Button>
            ) : null}
          </div>

          {dialog === 'correction' ? (
            <CorrectionDialog
              item={item}
              onClose={() => setDialog(null)}
              onSent={(message) => {
                setDialog(null)
                setNotice(message)
              }}
            />
          ) : null}
          {dialog === 'remove' ? (
            <RemoveDialog
              projectId={projectId}
              item={item}
              onClose={() => setDialog(null)}
              onRemoved={() => {
                setDialog(null)
                onRemoved()
              }}
              onExcludeInstead={() => {
                setDialog(null)
                setStateTarget('excluded')
              }}
            />
          ) : null}
        </article>
      ) : null}
    </StateBoundary>
  )
}
