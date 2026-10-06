import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { evidenceKeys, proposeCorrection, removeEvidence, type RemoveOutcome } from '@/api/evidence'
import { userMessage } from '@/api/errors'
import type { EvidenceItem } from '@/api/schemas/evidence'
import { projectKeys } from '@/api/projects'
import { usePreferences } from '@/app/preferencesContext'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { correctionTarget, evidenceCode } from './evidenceModel'
import styles from './Evidence.module.css'

const FIELDS = ['page', 'volume', 'matn', 'chain_narrator', 'chain_order', 'other'] as const

export function CorrectionDialog({
  item,
  onClose,
  onSent,
}: {
  item: EvidenceItem
  onClose: () => void
  onSent: (message: string) => void
}) {
  const { t } = useTranslation()
  const target = correctionTarget(item.resource)
  const [field, setField] = useState<(typeof FIELDS)[number]>('page')
  const [current, setCurrent] = useState('')
  const [proposed, setProposed] = useState('')
  const [explanation, setExplanation] = useState('')
  const [invalid, setInvalid] = useState(false)

  const send = useMutation({
    mutationFn: () =>
      proposeCorrection({
        corpus_table: target!.corpus_table,
        corpus_id: target!.corpus_id,
        current_value: current.trim() || t('evidence.correction.currentDefault'),
        proposed_value: `${t(`evidence.correction.fields.${field}`)}: ${proposed.trim()}`,
        evidence_notes: explanation.trim(),
        evidence_id: item.id,
      }),
    onSuccess: (p) => onSent(t('evidence.correction.sent', { code: `COR-${String(p.id).padStart(4, '0')}` })),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!proposed.trim() || explanation.trim().length < 10) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    send.mutate()
  }

  return (
    <Modal title={t('evidence.correction.title')} onClose={onClose} wide>
      {target ? (
        <form className={styles.dialogForm} onSubmit={submit}>
          <p className="mono">{t('evidence.correction.kicker', { code: target.code })}</p>
          <label className={styles.inlineField}>
            <span>{t('evidence.correction.field')}</span>
            <select value={field} onChange={(e) => setField(e.target.value as typeof field)}>
              {FIELDS.map((f) => (
                <option key={f} value={f}>
                  {t(`evidence.correction.fields.${f}`)}
                </option>
              ))}
            </select>
          </label>
          <Field label={t('evidence.correction.current')}>
            <input value={current} placeholder={t('evidence.correction.currentDefault')} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
          <Field label={t('evidence.correction.proposed')} requirement="required" error={invalid && !proposed.trim() ? t('common.required') : undefined}>
            <input value={proposed} onChange={(e) => setProposed(e.target.value)} />
          </Field>
          <Field
            label={t('evidence.correction.explanation')}
            requirement="required"
            hint={t('evidence.correction.explanationHint')}
            error={invalid && explanation.trim().length < 10 ? t('evidence.correction.explanationHint') : undefined}
          >
            <textarea rows={3} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
          </Field>
          <p className={styles.hint}>{t('evidence.correction.note')}</p>
          {send.isError ? (
            <p role="alert" className={styles.bad}>
              <strong>{t('evidence.correction.failed')}.</strong> {userMessage(send.error, t('states.error.body'))}
            </p>
          ) : null}
          <div className={styles.dialogActions}>
            <Button onClick={onClose} disabled={send.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={send.isPending}>
              {t('evidence.correction.submit')}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <p>{t('evidence.correction.noRecord')}</p>
          <div className={styles.dialogActions}>
            <Button onClick={onClose}>{t('common.close')}</Button>
          </div>
        </>
      )}
    </Modal>
  )
}

/**
 * Removing evidence is checked first: without `confirm` the API says whether findings or documents still
 * use it. If they do, the dialog lists them and offers "Mark Excluded instead" before the real removal.
 */
export function RemoveDialog({
  projectId,
  item,
  onClose,
  onRemoved,
  onExcludeInstead,
}: {
  projectId: number
  item: EvidenceItem
  onClose: () => void
  onRemoved: () => void
  onExcludeInstead: () => void
}) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const qc = useQueryClient()
  const [inUse, setInUse] = useState<Extract<RemoveOutcome, { kind: 'in-use' }> | null>(null)

  const run = useMutation({
    mutationFn: (confirm: boolean) => removeEvidence(projectId, item.id, confirm),
    onSuccess: async (outcome) => {
      if (outcome.kind === 'in-use') {
        setInUse(outcome)
        return
      }
      await qc.invalidateQueries({ queryKey: evidenceKeys.all(projectId) })
      void qc.invalidateQueries({ queryKey: ['project', projectId] })
      void qc.invalidateQueries({ queryKey: projectKeys.all })
      onRemoved()
    },
  })

  const code = evidenceCode(item.id)
  const title = item.resource?.title ?? code

  return (
    <Modal title={t('evidence.remove.title', { title })} onClose={onClose}>
      <p className="mono">{t('evidence.remove.dialogKicker', { code })}</p>
      {inUse ? (
        <>
          <h3>{t('evidence.remove.inUseTitle')}</h3>
          <p>
            {t('evidence.remove.inUse', {
              findings: t('evidence.remove.findingsCount', { count: inUse.findings, formattedCount: n(inUse.findings) }),
              citations: t('evidence.remove.citationsCount', { count: inUse.citations, formattedCount: n(inUse.citations) }),
            })}
          </p>
          {inUse.findingTitles.length > 0 ? (
            <ul className={styles.plainList}>
              {inUse.findingTitles.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          ) : null}
          <p>{t('evidence.remove.kept')}</p>
        </>
      ) : (
        <p>{t('evidence.remove.plain')}</p>
      )}
      {run.isError ? (
        <p role="alert" className={styles.bad}>
          <strong>{t('evidence.remove.failed')}.</strong> {userMessage(run.error, t('states.error.body'))}
        </p>
      ) : null}
      <div className={styles.dialogActions}>
        <Button onClick={onClose} disabled={run.isPending}>
          {t('common.cancel')}
        </Button>
        {inUse && item.state !== 'excluded' ? (
          <Button onClick={onExcludeInstead} disabled={run.isPending}>
            {t('evidence.remove.excludeInstead')}
          </Button>
        ) : null}
        <Button variant="danger" disabled={run.isPending} onClick={() => run.mutate(inUse !== null)}>
          {t('evidence.remove.confirm', { code })}
        </Button>
      </div>
    </Modal>
  )
}
