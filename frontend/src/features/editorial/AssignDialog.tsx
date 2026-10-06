import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { assignReviewer, listReviewerCandidates } from '@/api/editorial'
import { invalidate } from '@/api/invalidate'
import { qk } from '@/api/queryKeys'
import type { EditorSubmission } from '@/api/schemas/editorial'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { MutationNotice } from '@/components/MutationNotice'
import { useNow } from '@/hooks/useNow'
import dialog from '@/components/Dialog.module.css'
import { matchesCandidate, tomorrow } from './editorialModel'
import styles from './Editorial.module.css'

/**
 * Ask a reviewer. The candidates come from the server with their conflict analysis; a blocked one cannot be chosen and
 * the reason is shown, one already assigned is marked. The editor confirms that they know of no conflict of their own
 * with the choice. Mounted only while open, so the list is asked for only when needed.
 */
export function AssignDialog({ submission, onClose }: { submission: EditorSubmission; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const now = useNow()
  const [term, setTerm] = useState('')
  const [chosen, setChosen] = useState<number | null>(null)
  const [due, setDue] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const candidates = useQuery({ queryKey: qk.editor.candidates(submission.id), queryFn: ({ signal }) => listReviewerCandidates(submission.id, signal), retry: false })
  const assigned = new Set((submission.reviews ?? []).map((r) => r.reviewer_id).filter((x): x is number => typeof x === 'number'))
  const shown = (candidates.data ?? []).filter((c) => matchesCandidate(c, term))

  const assign = useMutation({
    mutationFn: () => assignReviewer(submission.id, { reviewer_id: chosen!, due_date: due }),
    onSuccess: async () => {
      await invalidate.editorialChanged(qc, submission.id)
      onClose()
    },
  })

  return (
    <Modal title={t('editorial.assign.title')} onClose={onClose} wide>
      <Field label={t('editorial.assign.search')}>
        <input type="search" dir="auto" value={term} onChange={(e) => setTerm(e.target.value)} />
      </Field>
      {candidates.isPending ? <p>{t('states.loading.label')}</p> : null}
      {candidates.isError ? (
        <div role="alert">
          <p>{t('editorial.assign.failedList')}</p>
          <Button onClick={() => void candidates.refetch()}>{t('common.retry')}</Button>
        </div>
      ) : null}
      {candidates.data ? (
        <fieldset className={styles.candidates}>
          <legend className="sr-only">{t('editorial.assign.candidates')}</legend>
          {shown.length === 0 ? <p className={styles.meta}>{t('editorial.assign.none')}</p> : null}
          {shown.map((c) => {
            const blocked = c.coi?.blocked === true
            const already = assigned.has(c.id)
            return (
              <label key={c.id} className={styles.candidate}>
                <input type="radio" name="reviewer" value={c.id} disabled={blocked || already} checked={chosen === c.id} onChange={() => setChosen(c.id)} />
                <span>
                  <BidiText>{c.display_name ?? `#${c.id}`}</BidiText>
                  <small>
                    {c.affiliation ? <BidiText>{c.affiliation}</BidiText> : null} · {t('editorial.assign.prior', { count: c.prior_reviews_count ?? 0 })}
                  </small>
                  {blocked ? <small className={styles.blocked}>{t('editorial.assign.blocked')}: {c.coi?.reason ?? t('editorial.assign.blockedUnknown')}</small> : null}
                  {already ? <small>{t('editorial.assign.already')}</small> : null}
                </span>
              </label>
            )
          })}
        </fieldset>
      ) : null}
      <Field label={t('editorial.assign.due')} requirement="optional" hint={t('editorial.assign.dueHint')}>
        <input type="date" min={tomorrow(now)} value={due} onChange={(e) => setDue(e.target.value)} />
      </Field>
      <label className={styles.radio}>
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> {t('editorial.assign.coi')}
      </label>
      <p className={styles.meta}>{t('editorial.assign.note')}</p>
      <MutationNotice error={assign.error} title={t('editorial.assign.failed')} />
      <div className={dialog.actions}>
        <Button onClick={onClose} disabled={assign.isPending}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" onClick={() => assign.mutate()} disabled={assign.isPending || chosen === null || !confirmed}>
          {t('editorial.assign.submit')}
        </Button>
      </div>
    </Modal>
  )
}
