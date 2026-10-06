import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { decideSubmission } from '@/api/editorial'
import { invalidate } from '@/api/invalidate'
import { DECISIONS, type Decision, type EditorSubmission } from '@/api/schemas/editorial'
import { Button } from '@/components/Button'
import { ConfirmAction } from '@/components/ConfirmAction'
import { Field } from '@/components/Field'
import { MutationNotice } from '@/components/MutationNotice'
import { formatCode } from '@/domain/codes'
import { canApprove } from './editorialModel'
import styles from './Editorial.module.css'

const MIN_NOTES = 10

/**
 * The decision on this package. Approval needs a finished review (the radio says why when it is off). The reason is
 * required, ten characters at least, and goes to the authors. The editor confirms they have no conflict. Nothing is sent
 * until it is confirmed in a dialog that says what happens.
 */
export function DecisionForm({ submission }: { submission: EditorSubmission }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [decision, setDecision] = useState<Decision | null>(null)
  const [notes, setNotes] = useState('')
  const [coi, setCoi] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const approvable = canApprove(submission)

  const decide = useMutation({
    mutationFn: () => decideSubmission(submission.id, { decision: decision!, decision_notes: notes.trim() }),
    onSuccess: async () => {
      await invalidate.editorialChanged(qc, submission.id)
      setConfirming(false)
    },
  })
  const ready = decision !== null && notes.trim().length >= MIN_NOTES && coi
  const short = notes.trim().length > 0 && notes.trim().length < MIN_NOTES

  return (
    <form
      className={styles.panel}
      aria-label={t('editorial.decide.title', { code: formatCode('SUB', submission.id) })}
      onSubmit={(e) => {
        e.preventDefault()
        if (ready) setConfirming(true)
      }}
    >
      <h2>{t('editorial.decide.title', { code: formatCode('SUB', submission.id) })}</h2>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="sr-only">{t('editorial.decide.choose')}</legend>
        {DECISIONS.map((d) => {
          const off = d === 'approve' && !approvable
          return (
            <label key={d} className={styles.radio}>
              <input type="radio" name="decision" value={d} disabled={off} checked={decision === d} onChange={() => setDecision(d)} />
              <span>
                {t(`editorial.decide.options.${d}`)}
                {off ? <small>{t('editorial.decide.needsReview')}</small> : null}
              </span>
            </label>
          )
        })}
      </fieldset>
      <Field label={t('editorial.decide.notes')} requirement="required" hint={t('editorial.decide.notesHint', { min: MIN_NOTES })} error={short ? t('editorial.decide.notesShort', { min: MIN_NOTES }) : undefined}>
        <textarea rows={5} dir="auto" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <label className={styles.radio}>
        <input type="checkbox" checked={coi} onChange={(e) => setCoi(e.target.checked)} /> {t('editorial.decide.coi')}
      </label>
      <p className={styles.meta}>{t('editorial.decide.approveNote')}</p>
      <MutationNotice error={decide.error} title={t('editorial.decide.failed')} />
      <Button type="submit" variant="primary" disabled={!ready || decide.isPending}>
        {t('editorial.decide.submit')}
      </Button>

      {confirming && decision ? (
        <ConfirmAction
          open
          danger={decision === 'reject'}
          busy={decide.isPending}
          title={t(`editorial.decide.confirm.${decision}.title`, { code: formatCode('SUB', submission.id) })}
          confirmLabel={t(`editorial.decide.confirm.${decision}.action`)}
          onConfirm={() => decide.mutate()}
          onCancel={() => setConfirming(false)}
        >
          <p>{t(`editorial.decide.confirm.${decision}.body`)}</p>
          <p>
            <strong>{t('editorial.decide.toAuthors')}</strong> {notes.trim()}
          </p>
        </ConfirmAction>
      ) : null}
    </form>
  )
}
