import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { linkFinding, listEvidence } from '@/api/evidence'
import { invalidate } from '@/api/invalidate'
import { qk } from '@/api/queryKeys'
import { RELATIONS, type Relation } from '@/api/schemas/writing'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { MutationNotice } from '@/components/MutationNotice'
import { evidenceCode } from '../evidence/evidenceModel'
import { findingCode } from './writingModel'
import styles from './Writing.module.css'

interface Props {
  projectId: number
  findingId: number
  /** Evidence already linked to the finding (not offered again). */
  linkedIds: ReadonlySet<number>
  onClose: () => void
}

const excerpt = (s: string) => (s.length > 70 ? `${s.slice(0, 70).trimEnd()}…` : s)

/** Link an evidence item of this project to a finding, saying how it bears on it. */
export function LinkEvidenceDialog({ projectId, findingId, linkedIds, onClose }: Props) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [evidenceId, setEvidenceId] = useState('')
  const [relation, setRelation] = useState<Relation>('supporting')
  const [interpretation, setInterpretation] = useState('')

  const evidence = useQuery({
    queryKey: qk.project(projectId).evidence.list({ per_page: 100 }),
    queryFn: ({ signal }) => listEvidence(projectId, { per_page: 100 }, signal),
  })
  const choices = (evidence.data?.items ?? []).filter((e) => !linkedIds.has(e.id))

  const link = useMutation({
    mutationFn: () => linkFinding(projectId, findingId, Number(evidenceId), relation, interpretation.trim()),
    onSuccess: async () => {
      await invalidate.findingsChanged(qc, projectId)
      onClose()
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (evidenceId) link.mutate()
  }

  return (
    <Modal title={t('writing.linkEvidence.title', { code: findingCode(findingId) })} onClose={onClose} wide>
      <form className={styles.dialogForm} onSubmit={submit}>
        {evidence.isPending ? <p role="status">{t('states.loading.label')}</p> : null}
        {evidence.isError ? <p role="alert">{t('writing.linkEvidence.loadFailed')}</p> : null}
        {evidence.data && choices.length === 0 ? <p>{t('writing.linkEvidence.none')}</p> : null}
        {choices.length > 0 ? (
          <>
            <Field label={t('writing.linkEvidence.evidence')} requirement="required">
              <select value={evidenceId} onChange={(e) => setEvidenceId(e.target.value)}>
                <option value="" />
                {choices.map((e) => (
                  <option key={e.id} value={e.id}>
                    {evidenceCode(e.id)} · {e.resource?.title ?? ''}: {excerpt(e.captured_text)}
                  </option>
                ))}
              </select>
            </Field>
            <div role="radiogroup" aria-label={t('writing.linkEvidence.relation')} className={styles.choices}>
              {RELATIONS.map((r) => (
                <label key={r} className={styles.choice}>
                  <input type="radio" name="relation" checked={relation === r} onChange={() => setRelation(r)} />
                  {t(`writing.relation.${r}`)}
                </label>
              ))}
            </div>
            <Field label={t('writing.linkEvidence.interpretation')}>
              <textarea rows={2} value={interpretation} onChange={(e) => setInterpretation(e.target.value)} />
            </Field>
          </>
        ) : null}
        <p className={styles.hint}>{t('writing.linkEvidence.note')}</p>
        <MutationNotice error={link.error} title={t('writing.finding.linkFailed')} />
        <div className={styles.dialogActions}>
          <Button onClick={onClose} disabled={link.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={!evidenceId || link.isPending}>
            {t('writing.linkEvidence.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
