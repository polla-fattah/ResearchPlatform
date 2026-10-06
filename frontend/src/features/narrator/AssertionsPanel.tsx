import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { createAssertion, deleteAssertion, listAssertions, updateAssertion } from '@/api/narratorDossier'
import { invalidate } from '@/api/invalidate'
import { qk } from '@/api/queryKeys'
import { UNCERTAINTY_LEVELS, type Assertion } from '@/api/schemas/narratorDossier'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { ConfirmAction } from '@/components/ConfirmAction'
import dialog from '@/components/Dialog.module.css'
import { Field } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { MutationNotice } from '@/components/MutationNotice'
import { RefreshNotice } from '@/components/RefreshNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { alternativeClaim, alternativeSource, isUncertainty } from './narratorModel'
import styles from './Narrator.module.css'

type Dialog = { kind: 'form'; existing: Assertion | null } | { kind: 'delete'; assertion: Assertion } | null

/**
 * What this project holds to be true about the narrator ("died in 197 AH"), with how sure the researchers are and the
 * alternatives kept beside it. Claims are free text on the server: no date, no source field, and no "which alternative
 * was chosen", so none of that is drawn or computed here (request file C-37).
 */
export function AssertionsPanel({ projectId, narratorId, narratorName, canEdit }: { projectId: number; narratorId: number; narratorName: string; canEdit: boolean }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [dlg, setDlg] = useState<Dialog>(null)
  const list = useQuery({ queryKey: qk.project(projectId).narrator(narratorId).assertions, queryFn: ({ signal }) => listAssertions(projectId, narratorId, signal) })
  const remove = useMutation({
    mutationFn: (a: Assertion) => deleteAssertion(projectId, a.id),
    onSuccess: async () => {
      await invalidate.narratorDossierChanged(qc, projectId, narratorId)
      setDlg(null)
    },
  })
  const items = list.data ?? []
  const view = list.data ? 'normal' : viewStateOf(list)

  return (
    <section className={styles.section} aria-labelledby="assertions-h">
      <div className={styles.head}>
        <h2 id="assertions-h">{t('narrator.assertions.title')}</h2>
        {canEdit ? <Button onClick={() => setDlg({ kind: 'form', existing: null })}>{t('narrator.assertions.add')}</Button> : null}
      </div>
      <p className={styles.meta}>{t('narrator.assertions.note')}</p>
      <StateBoundary state={view} errorValue={list.error} onRetry={() => void list.refetch()}>
        <RefreshNotice query={list} what={t('narrator.assertions.title')} />
        {items.length === 0 ? (
          <p className={styles.empty}>{t('narrator.assertions.empty')}</p>
        ) : (
          <ul className={styles.members} aria-label={t('narrator.assertions.title')}>
            {items.map((a) => (
              <li key={a.id} className={styles.member}>
                <div>
                  <strong>
                    <BidiText>{a.assertion_claim}</BidiText>
                  </strong>{' '}
                  <span className={styles.rel}>{isUncertainty(a.uncertainty_level) ? t(`narrator.levels.${a.uncertainty_level}`) : t('narrator.levels.unknown')}</span>
                  {a.competing_alternatives.length > 0 ? (
                    <>
                      <p className={styles.meta}>{t('narrator.assertions.alternatives')}</p>
                      <ul className={styles.alts}>
                        {a.competing_alternatives.map((alt, i) => (
                          <li key={i}>
                            <BidiText>{alternativeClaim(alt)}</BidiText>
                            {alternativeSource(alt) ? <span className={styles.meta}> · {alternativeSource(alt)}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  {a.adjudication_notes ? (
                    <p className={styles.meta}>
                      {t('narrator.assertions.adjudication')}: <BidiText>{a.adjudication_notes}</BidiText>
                    </p>
                  ) : null}
                </div>
                {canEdit ? (
                  <div className={styles.actions}>
                    <Button onClick={() => setDlg({ kind: 'form', existing: a })}>{t('narrator.assertions.edit')}</Button>
                    <Button onClick={() => setDlg({ kind: 'delete', assertion: a })}>{t('narrator.assertions.delete')}</Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </StateBoundary>
      {dlg?.kind === 'form' ? <AssertionDialog projectId={projectId} narratorId={narratorId} narratorName={narratorName} existing={dlg.existing} onClose={() => setDlg(null)} /> : null}
      {dlg?.kind === 'delete' ? (
        <ConfirmAction
          open
          danger
          busy={remove.isPending}
          title={t('narrator.assertions.deleteTitle')}
          confirmLabel={t('narrator.assertions.delete')}
          onConfirm={() => remove.mutate(dlg.assertion)}
          onCancel={() => setDlg(null)}
        >
          <p>{t('narrator.assertions.deleteBody')}</p>
          <MutationNotice error={remove.error} title={t('narrator.assertions.deleteFailed')} />
        </ConfirmAction>
      ) : null}
    </section>
  )
}

function AssertionDialog({ projectId, narratorId, narratorName, existing, onClose }: { projectId: number; narratorId: number; narratorName: string; existing: Assertion | null; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const schema = z.object({
    claim: z.string().trim().min(1, t('narrator.assertions.claimRequired')),
    level: z.enum(UNCERTAINTY_LEVELS),
    alternatives: z.array(z.object({ claim: z.string(), source: z.string() })),
    notes: z.string(),
  })
  type Values = z.infer<typeof schema>
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      claim: existing?.assertion_claim ?? '',
      level: existing && isUncertainty(existing.uncertainty_level) ? existing.uncertainty_level : 'probable',
      alternatives: (existing?.competing_alternatives ?? []).map((a) => ({ claim: alternativeClaim(a), source: alternativeSource(a) })),
      notes: existing?.adjudication_notes ?? '',
    },
  })
  const alts = useFieldArray({ control, name: 'alternatives' })
  const save = useMutation({
    mutationFn: (v: Values) => {
      const competing_alternatives = v.alternatives.filter((a) => a.claim.trim()).map((a) => ({ claim: a.claim.trim(), source: a.source.trim() }))
      return existing
        ? updateAssertion(projectId, existing.id, { assertion_claim: v.claim.trim(), uncertainty_level: v.level, competing_alternatives, adjudication_notes: v.notes.trim() || undefined })
        : createAssertion(projectId, { subject_id: narratorId, subject_name: narratorName, assertion_claim: v.claim.trim(), uncertainty_level: v.level, competing_alternatives, adjudication_notes: v.notes.trim() || undefined })
    },
    onSuccess: async () => {
      await invalidate.narratorDossierChanged(qc, projectId, narratorId)
      onClose()
    },
  })
  return (
    <Modal title={existing ? t('narrator.assertions.editTitle') : t('narrator.assertions.addTitle')} onClose={onClose} wide>
      <form noValidate onSubmit={handleSubmit((v) => save.mutate(v))}>
        <Field label={t('narrator.assertions.claim')} requirement="required" error={errors.claim?.message} hint={t('narrator.assertions.claimHint')}>
          <textarea rows={2} dir="auto" aria-invalid={errors.claim ? true : undefined} {...register('claim')} />
        </Field>
        <Field label={t('narrator.assertions.level')} requirement="required">
          <select {...register('level')}>
            {UNCERTAINTY_LEVELS.map((l) => (
              <option key={l} value={l}>
                {t(`narrator.levels.${l}`)}
              </option>
            ))}
          </select>
        </Field>
        <fieldset>
          <legend>{t('narrator.assertions.alternatives')}</legend>
          {alts.fields.map((f, i) => (
            <div key={f.id} className={styles.actions}>
              <Field label={t('narrator.assertions.altClaim', { n: i + 1 })} requirement="optional">
                <input dir="auto" {...register(`alternatives.${i}.claim`)} />
              </Field>
              <Field label={t('narrator.assertions.altSource', { n: i + 1 })} requirement="optional">
                <input dir="auto" {...register(`alternatives.${i}.source`)} />
              </Field>
              <Button onClick={() => alts.remove(i)}>{t('narrator.assertions.altRemove', { n: i + 1 })}</Button>
            </div>
          ))}
          <Button onClick={() => alts.append({ claim: '', source: '' })}>{t('narrator.assertions.altAdd')}</Button>
        </fieldset>
        <Field label={t('narrator.assertions.adjudication')} requirement="optional" hint={existing ? t('narrator.assertions.cannotClear') : t('narrator.assertions.adjudicationHint')}>
          <textarea rows={3} dir="auto" {...register('notes')} />
        </Field>
        <MutationNotice error={save.error} title={t('narrator.assertions.failed')} />
        <div className={dialog.actions}>
          <Button onClick={onClose} disabled={save.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {t('narrator.assertions.save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
