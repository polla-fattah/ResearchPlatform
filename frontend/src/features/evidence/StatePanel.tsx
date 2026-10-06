import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { evidenceKeys, getHistory, setEvidenceState } from '@/api/evidence'
import type { EvidenceItem } from '@/api/schemas/evidence'
import { usePreferences } from '@/app/preferencesContext'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { EVIDENCE_STATES } from '@/domain/vocab'
import { evidenceCode, needsReason, writeError } from './evidenceModel'
import styles from './Evidence.module.css'

interface Props {
  projectId: number
  item: EvidenceItem
  /** Findings that link this evidence (their number is shown in the confirmation). */
  findingsCount: number
  canEdit: boolean
  /** The state a change dialog is open for (lifted so "Mark Excluded instead" can open it). */
  target: string | null
  onTarget: (state: string | null) => void
}

export function StatePanel({ projectId, item, findingsCount, canEdit, target, onTarget }: Props) {
  const { t } = useTranslation()
  const { n, date } = usePreferences()
  const qc = useQueryClient()
  const [reason, setReason] = useState('')
  const [reasonMissing, setReasonMissing] = useState(false)

  const history = useQuery({
    queryKey: evidenceKeys.history(projectId, item.id),
    queryFn: ({ signal }) => getHistory(projectId, item.id, signal),
  })

  const change = useMutation({
    mutationFn: (to: string) => setEvidenceState(projectId, item.id, to, reason.trim() || null),
    onSuccess: () => {
      onTarget(null)
      setReason('')
      void qc.invalidateQueries({ queryKey: evidenceKeys.all(projectId) })
      void qc.invalidateQueries({ queryKey: ['project', projectId] })
      void qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const close = () => {
    change.reset()
    onTarget(null)
    setReason('')
    setReasonMissing(false)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!target) return
    if (needsReason(target) && !reason.trim()) {
      setReasonMissing(true)
      return
    }
    setReasonMissing(false)
    change.mutate(target)
  }

  const who = history.data?.collector ?? item.collector?.display_name ?? t('evidence.history.unknown')

  return (
    <section className={styles.section} aria-label={t('evidence.state.heading')}>
      <h3>{t('evidence.state.heading')}</h3>
      <p className={styles.hint}>{t('evidence.state.note')}</p>

      <div role="radiogroup" aria-label={t('evidence.state.current')} className={styles.stateRow}>
        {EVIDENCE_STATES.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={item.state === s}
            disabled={!canEdit || item.state === s}
            className={[styles.stateBtn, item.state === s ? styles.stateOn : ''].join(' ')}
            onClick={() => onTarget(s)}
            title={canEdit && item.state !== s ? t('evidence.state.mark', { state: t(`evidenceState.${s}`) }) : undefined}
          >
            {t(`evidenceState.${s}`)}
          </button>
        ))}
      </div>
      {!canEdit ? <p className={styles.hint}>{t('evidence.state.readOnly')}</p> : null}
      {item.exclusion_reason && needsReason(item.state) ? (
        <p className={styles.reasonLine}>{t('evidence.state.reasonShown', { reason: item.exclusion_reason })}</p>
      ) : null}

      <h4 className={styles.subHeading}>{t('evidence.history.heading')}</h4>
      {history.isError ? <p role="alert">{t('evidence.history.failed')}</p> : null}
      <ol className={styles.history}>
        {(history.data?.history ?? []).map((h, i) => (
          <li key={h.id ?? i}>
            <span className={styles.hint}>{h.created_at ? date(h.created_at, { time: true }) : ''}</span> {h.summary ?? h.action}
            {h.actor ? <span className={styles.hint}> · {h.actor.display_name}</span> : null}
          </li>
        ))}
        <li>
          <span className={styles.hint}>{item.created_at ? date(item.created_at, { time: true }) : ''}</span>{' '}
          {t('evidence.history.created', { who })}
        </li>
      </ol>

      {target ? (
        <Modal title={t('evidence.state.dialogTitle', { code: evidenceCode(item.id), from: t(`evidenceState.${item.state}`, { defaultValue: item.state }), to: t(`evidenceState.${target}`) })} onClose={close}>
          <form onSubmit={submit} className={styles.dialogForm}>
            <p>{t('evidence.state.mark', { state: t(`evidenceState.${target}`) })}</p>
            <Field
              label={t('evidence.state.reason')}
              requirement={needsReason(target) ? 'required' : 'optional'}
              hint={needsReason(target) ? t('evidence.state.reasonRequired') : t('evidence.state.reasonOptional')}
              error={reasonMissing ? t('evidence.state.needReason') : undefined}
            >
              <textarea autoFocus rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            {findingsCount > 0 ? (
              <p className={styles.hint}>
                {t('evidence.state.usedIn', { count: findingsCount, formattedCount: n(findingsCount), state: t(`evidenceState.${target}`) })}
              </p>
            ) : null}
            {change.isError ? (
              <p role="alert" className={styles.bad}>
                <strong>{t('evidence.state.failed')}.</strong> {writeError(change.error, t, 'state')}
              </p>
            ) : null}
            <div className={styles.dialogActions}>
              <Button onClick={close} disabled={change.isPending}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" variant="primary" disabled={change.isPending}>
                {t('evidence.state.confirm')}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </section>
  )
}
