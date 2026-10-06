import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { getHadith } from '@/api/corpus'
import { listEvidence } from '@/api/evidence'
import { addMember, createFamily } from '@/api/families'
import { invalidate } from '@/api/invalidate'
import { qk } from '@/api/queryKeys'
import { RELATIONSHIPS, type Family } from '@/api/schemas/families'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { MutationNotice } from '@/components/MutationNotice'
import { evidenceCode } from '@/features/evidence/evidenceModel'
import dialog from '@/components/Dialog.module.css'
import { alreadyInFamily, parseDepth } from './familiesModel'
import styles from './Families.module.css'

/** Start a family: a title, and optionally the Companion at the root and the theme it shares. Mounted only while open. */
export function NewFamilyDialog({ projectId, onClose, onCreated }: { projectId: number; onClose: () => void; onCreated: (family: Family) => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const schema = z.object({ title: z.string().trim().min(1, t('families.new.titleRequired')).max(255), companion: z.string().max(255), theme: z.string() })
  type Values = z.infer<typeof schema>
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { title: '', companion: '', theme: '' } })
  const create = useMutation({
    mutationFn: (v: Values) => createFamily(projectId, { canonical_title: v.title.trim(), root_companion: v.companion.trim(), core_theme: v.theme.trim() }),
    onSuccess: async (family) => {
      await invalidate.familiesChanged(qc, projectId)
      onCreated(family)
    },
  })
  return (
    <Modal title={t('families.new.title')} onClose={onClose}>
      <form noValidate onSubmit={handleSubmit((v) => create.mutate(v))}>
        <Field label={t('families.new.titleLabel')} requirement="required" error={errors.title?.message}>
          <input dir="auto" aria-invalid={errors.title ? true : undefined} {...register('title')} />
        </Field>
        <Field label={t('families.new.companion')} requirement="optional" hint={t('families.new.companionHint')}>
          <input dir="auto" {...register('companion')} />
        </Field>
        <Field label={t('families.new.theme')} requirement="optional">
          <textarea rows={3} dir="auto" {...register('theme')} />
        </Field>
        <MutationNotice error={create.error} title={t('families.new.failed')} />
        <div className={dialog.actions}>
          <Button onClick={onClose} disabled={create.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {t('families.new.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/**
 * Add a member: a piece of this project's evidence, or a report of the corpus by its number (the report is looked up
 * first, so a number that does not exist is refused here and not stored). The relationship is chosen by the researcher;
 * "candidate" says it has not been classified yet. Mounted only while open.
 */
export function AddMemberDialog({ projectId, family, onClose }: { projectId: number; family: Family; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const schema = z
    .object({
      kind: z.enum(['evidence', 'report']),
      evidence: z.string(),
      report: z.string(),
      relationship: z.enum(RELATIONSHIPS),
      narrator: z.string().max(255),
      depth: z.string(),
      notes: z.string(),
    })
    .superRefine((v, ctx) => {
      if (v.kind === 'evidence' && !v.evidence) ctx.addIssue({ code: 'custom', path: ['evidence'], message: t('families.add.chooseEvidence') })
      if (v.kind === 'report' && !/^\d+$/.test(v.report.trim())) ctx.addIssue({ code: 'custom', path: ['report'], message: t('families.add.reportNumber') })
      if (v.kind === 'report' && /^\d+$/.test(v.report.trim()) && alreadyInFamily(family, { corpus_hadith_id: Number(v.report.trim()) }))
        ctx.addIssue({ code: 'custom', path: ['report'], message: t('families.add.already') })
      if (v.kind === 'evidence' && v.evidence && alreadyInFamily(family, { evidence_id: Number(v.evidence) }))
        ctx.addIssue({ code: 'custom', path: ['evidence'], message: t('families.add.already') })
      if (!parseDepth(v.depth).ok) ctx.addIssue({ code: 'custom', path: ['depth'], message: t('families.add.depthInvalid') })
    })
  type Values = z.infer<typeof schema>
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { kind: 'evidence', evidence: '', report: '', relationship: 'candidate', narrator: '', depth: '', notes: '' } })
  const kind = useWatch({ control, name: 'kind' })

  const evidence = useQuery({
    queryKey: qk.project(projectId).evidence.list({ per_page: 100 }),
    queryFn: ({ signal }) => listEvidence(projectId, { per_page: 100 }, signal),
  })

  const add = useMutation({
    mutationFn: async (v: Values) => {
      const source = v.kind === 'evidence' ? { evidence_id: Number(v.evidence) } : { corpus_hadith_id: Number(v.report.trim()) }
      if (source.corpus_hadith_id) await getHadith(source.corpus_hadith_id)
      return addMember(projectId, family.id, {
        ...source,
        relationship_type: v.relationship,
        convergence_narrator: v.narrator.trim() || undefined,
        convergence_depth: parseDepth(v.depth).value,
        scholarly_notes: v.notes.trim() || undefined,
      })
    },
    onSuccess: async () => {
      await invalidate.familiesChanged(qc, projectId)
      onClose()
    },
  })

  return (
    <Modal title={t('families.add.title')} onClose={onClose} wide>
      <form noValidate onSubmit={handleSubmit((v) => add.mutate(v))}>
        <fieldset className={styles.radioRow} style={{ border: 0, padding: 0 }}>
          <legend>{t('families.add.source')}</legend>
          <label>
            <input type="radio" value="evidence" {...register('kind')} /> {t('families.add.fromEvidence')}
          </label>
          <label>
            <input type="radio" value="report" {...register('kind')} /> {t('families.add.fromReport')}
          </label>
        </fieldset>
        {kind === 'evidence' ? (
          <Field label={t('families.add.evidence')} requirement="required" error={errors.evidence?.message}>
            <select {...register('evidence')}>
              <option value="">{t('families.add.choose')}</option>
              {(evidence.data?.items ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {evidenceCode(e.id)} · {e.captured_text.slice(0, 60)}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label={t('families.add.report')} requirement="required" error={errors.report?.message} hint={t('families.add.reportHint')}>
            <input dir="ltr" inputMode="numeric" {...register('report')} />
          </Field>
        )}
        <Field label={t('families.add.relationship')} requirement="required" hint={t('families.add.relationshipHint')}>
          <select {...register('relationship')}>
            {RELATIONSHIPS.map((r) => (
              <option key={r} value={r}>
                {t(`families.relationships.${r}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('families.add.narrator')} requirement="optional" hint={t('families.add.narratorHint')}>
          <input dir="auto" {...register('narrator')} />
        </Field>
        <Field label={t('families.add.depth')} requirement="optional" error={errors.depth?.message}>
          <input dir="ltr" inputMode="numeric" {...register('depth')} />
        </Field>
        <Field label={t('families.add.notes')} requirement="optional" hint={t('families.add.notesHint')}>
          <textarea rows={3} dir="auto" {...register('notes')} />
        </Field>
        <MutationNotice error={add.error} title={t('families.add.failed')} />
        <div className={dialog.actions}>
          <Button onClick={onClose} disabled={add.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={add.isPending}>
            {t('families.add.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
