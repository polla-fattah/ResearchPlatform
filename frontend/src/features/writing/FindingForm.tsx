import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { ApiError } from '@/api/errors'
import { unlinkFinding } from '@/api/evidence'
import { createFinding, deleteFinding, updateFinding } from '@/api/findings'
import { invalidate } from '@/api/invalidate'
import { FINDING_STATUSES, type Finding, type FindingStatus } from '@/api/schemas/writing'
import { NeutralState } from '@/components/Badges'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { ConfirmAction } from '@/components/ConfirmAction'
import { Field } from '@/components/Field'
import { MutationNotice } from '@/components/MutationNotice'
import { evidenceCode } from '../evidence/evidenceModel'
import { LinkEvidenceDialog } from './LinkEvidenceDialog'
import { findingCode, groupByRelation, submissionGaps } from './writingModel'
import { RELATIONS } from '@/api/schemas/writing'
import styles from './Writing.module.css'

interface Props {
  projectId: number
  /** The finding being edited, or null for a new one. */
  finding: Finding | null
  canEdit: boolean
  onBack: () => void
  onCreated: (id: number) => void
  onOpenDocument: (id: number) => void
}

/**
 * One finding: question, claim, reasoning, limitations and status as a form; its evidence grouped by how it bears on
 * the claim; and where it is used. The form owns what is being typed; the finding is the server's copy, so a change
 * made by someone else is noticed (by `updated_at`) and offered, never merged silently.
 */
export function FindingForm({ projectId, finding, canEdit, onBack, onCreated, onOpenDocument }: Props) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [linking, setLinking] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // The server's `updated_at` this form was last in step with; a different one means someone else saved.
  const [baseline, setBaseline] = useState(finding?.updated_at ?? null)

  const required = t('writing.finding.required')
  const schema = z.object({
    question: z.string().trim().min(1, required),
    claim: z.string().trim().min(1, required),
    reasoning: z.string().trim().min(1, required),
    limitations: z.string(),
    status: z.enum(FINDING_STATUSES),
  })
  type Values = z.infer<typeof schema>

  const fromFinding = (f: Finding | null): Values => ({
    question: f?.question ?? '',
    claim: f?.claim ?? '',
    reasoning: f?.reasoning ?? '',
    limitations: f?.limitations ?? '',
    status: (FINDING_STATUSES as readonly string[]).includes(f?.status ?? '') ? (f!.status as FindingStatus) : 'provisional',
  })

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isDirty },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: fromFinding(finding) })
  const limitations = useWatch({ control, name: 'limitations' })

  const save = useMutation({
    mutationFn: async (v: Values) => {
      const fields = { ...v, limitations: v.limitations.trim() || null }
      return finding ? updateFinding(projectId, finding.id, fields, finding.version) : createFinding(projectId, fields)
    },
    onSuccess: async (saved) => {
      reset(fromFinding(saved))
      setBaseline(saved.updated_at ?? null)
      await invalidate.findingsChanged(qc, projectId)
      if (!finding) onCreated(saved.id)
    },
  })

  const unlink = useMutation({
    mutationFn: (evidenceId: number) => unlinkFinding(projectId, finding!.id, evidenceId),
    onSuccess: () => invalidate.findingsChanged(qc, projectId),
  })
  const remove = useMutation({
    mutationFn: () => deleteFinding(projectId, finding!.id),
    onSuccess: async () => {
      await invalidate.findingsChanged(qc, projectId)
      onBack()
    },
    onError: () => setConfirmDelete(false),
  })

  const changedElsewhere = !!finding && finding.updated_at !== baseline
  const conflict = save.error instanceof ApiError && save.error.status === 409
  const evidence = finding?.evidence_items ?? []
  const groups = groupByRelation(evidence)
  const gaps = submissionGaps({ limitations, evidence_items: evidence })
  const used = finding?.documents ?? []

  const showLatest = () => {
    if (!finding) return
    reset(fromFinding(finding))
    setBaseline(finding.updated_at ?? null)
    save.reset()
  }

  return (
    <section aria-label={finding ? findingCode(finding.id) : t('writing.finding.kickerNew')}>
      <div className={styles.docHead}>
        <Button variant="ghost" onClick={onBack}>
          {t('writing.back')}
        </Button>
        <p className={`mono ${styles.kicker}`}>{finding ? t('writing.finding.kicker', { code: findingCode(finding.id) }) : t('writing.finding.kickerNew')}</p>
        <span className={styles.status} role="status">
          {save.isPending ? t('writing.finding.saving') : isDirty ? t('writing.finding.unsaved') : finding ? t('writing.finding.saved') : ''}
        </span>
      </div>

      {!canEdit ? <p className={styles.hint}>{t('writing.finding.readOnly')}</p> : null}

      {changedElsewhere || conflict ? (
        <div className={styles.banner} role="alert">
          <p>{t('writing.finding.changedElsewhere')}</p>
          <Button onClick={showLatest}>{t('writing.finding.reload')}</Button>
        </div>
      ) : null}

      <form className={styles.findingForm} onSubmit={handleSubmit((v) => save.mutate(v))} noValidate>
        <fieldset disabled={!canEdit} className={styles.statusRow}>
          <legend>{t('writing.finding.status')}</legend>
          {FINDING_STATUSES.map((s) => (
            <label key={s} className={styles.choice}>
              <input type="radio" value={s} {...register('status')} />
              {t(`writing.status.${s}`)}
            </label>
          ))}
          <p className={styles.hint}>{t('writing.status.withdrawnUnavailable')}</p>
        </fieldset>

        <Field label={t('writing.finding.question')} requirement="required" error={errors.question?.message}>
          <textarea rows={2} dir="auto" disabled={!canEdit} aria-invalid={errors.question ? true : undefined} {...register('question')} />
        </Field>
        <Field label={t('writing.finding.claim')} requirement="required" error={errors.claim?.message}>
          <textarea rows={3} dir="auto" disabled={!canEdit} aria-invalid={errors.claim ? true : undefined} {...register('claim')} />
        </Field>
        <Field label={t('writing.finding.reasoning')} requirement="required" error={errors.reasoning?.message}>
          <textarea rows={6} dir="auto" disabled={!canEdit} aria-invalid={errors.reasoning ? true : undefined} {...register('reasoning')} />
        </Field>
        <Field label={t('writing.finding.limitations')} requirement="optional" hint={t('writing.finding.limitationsHint')}>
          <textarea rows={3} dir="auto" disabled={!canEdit} {...register('limitations')} />
        </Field>

        <MutationNotice error={conflict ? null : save.error} title={t('writing.finding.failed')} />

        {canEdit ? (
          <div className={styles.inline}>
            <Button type="submit" variant="primary" disabled={save.isPending || (!!finding && !isDirty)}>
              {finding ? t('writing.finding.save') : t('writing.finding.create')}
            </Button>
            {finding ? (
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                {t('writing.finding.delete')}
              </Button>
            ) : null}
          </div>
        ) : null}
        <MutationNotice error={remove.error} title={t('writing.finding.deleteFailed')} />
      </form>

      {finding ? (
        <>
          <section className={styles.section} aria-label={t('writing.finding.evidence')}>
            <h2 className={styles.paneTitle}>{t('writing.finding.evidence')}</h2>
            {evidence.length === 0 ? <NeutralState kind="unknown">{t('writing.finding.evidenceNone')}</NeutralState> : null}
            {RELATIONS.filter((r) => groups[r].length > 0).map((r) => (
              <div key={r} className={styles.relationGroup}>
                <h3>
                  {t(`writing.relation.${r}`)} · {groups[r].length}
                </h3>
                <ul className={styles.plain}>
                  {groups[r].map((e) => (
                    <li key={e.id} className={styles.rowLine}>
                      <span>
                        <span className="mono">{evidenceCode(e.id)}</span> <BidiText>{e.resource?.title ?? ''}</BidiText>
                        <span className={styles.quoteLine}>
                          <BidiText>{e.captured_text}</BidiText>
                        </span>
                        {e.pivot?.interpretation ? <span className={styles.hint}>{e.pivot.interpretation}</span> : null}
                      </span>
                      {canEdit ? (
                        <Button variant="ghost" disabled={unlink.isPending} onClick={() => unlink.mutate(e.id)} aria-label={`${t('writing.finding.unlink')} ${evidenceCode(e.id)}`}>
                          {t('writing.finding.unlink')}
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <MutationNotice error={unlink.error} title={t('writing.finding.linkFailed')} />
            {canEdit ? <Button onClick={() => setLinking(true)}>{t('writing.finding.linkEvidence')}</Button> : null}
          </section>

          <section className={styles.section} aria-label={t('writing.finding.usedIn')}>
            <h2 className={styles.paneTitle}>{t('writing.finding.usedIn')}</h2>
            {used.length === 0 ? <p className={styles.hint}>{t('writing.finding.usedInNone')}</p> : null}
            <ul className={styles.plain}>
              {used.map((d) => (
                <li key={d.id}>
                  <button type="button" className={styles.linkButton} onClick={() => onOpenDocument(d.id)}>
                    <BidiText>{d.title}</BidiText>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.section} aria-label={t('writing.finding.contributors')}>
            <h2 className={styles.paneTitle}>{t('writing.finding.contributors')}</h2>
            {finding.contributors && finding.contributors.length > 0 ? (
              <p>{finding.contributors.join(' · ')}</p>
            ) : (
              <NeutralState kind="unknown">{t('writing.finding.contributorsNone')}</NeutralState>
            )}
          </section>

          <section className={styles.note} aria-label={t('writing.finding.submission.title')}>
            <h2 className={styles.paneTitle}>{t('writing.finding.submission.title')}</h2>
            <p>
              {gaps.length === 0
                ? t('writing.finding.submission.ok')
                : t('writing.finding.submission.body', {
                    count: gaps.length,
                    formattedCount: gaps.length,
                    fields: gaps.map((g) => t(`writing.finding.submission.${g}`)).join(', '),
                  })}
            </p>
          </section>

          {linking ? (
            <LinkEvidenceDialog projectId={projectId} findingId={finding.id} linkedIds={new Set(evidence.map((e) => e.id))} onClose={() => setLinking(false)} />
          ) : null}
          <ConfirmAction
            open={confirmDelete}
            danger
            title={t('writing.finding.deleteTitle')}
            confirmLabel={t('writing.finding.deleteConfirm')}
            busy={remove.isPending}
            onCancel={() => setConfirmDelete(false)}
            onConfirm={() => remove.mutate()}
          >
            <p>{t('writing.finding.deleteBody')}</p>
            {used.length > 0 ? <p>{t('writing.finding.deleteUsed', { count: used.length, formattedCount: used.length })}</p> : null}
          </ConfirmAction>
        </>
      ) : null}
    </section>
  )
}
