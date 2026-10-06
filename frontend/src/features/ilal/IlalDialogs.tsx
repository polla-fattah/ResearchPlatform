import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { appendToCase, createCase } from '@/api/ilal'
import { invalidate } from '@/api/invalidate'
import { DISCREPANCIES, type IlalCase } from '@/api/schemas/ilal'
import { Button } from '@/components/Button'
import dialog from '@/components/Dialog.module.css'
import { Field } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { MutationNotice } from '@/components/MutationNotice'

/** Open a case: a title and the kind of discrepancy. Versions and critics are added on the case itself. Mounted only while open. */
export function NewCaseDialog({ projectId, onClose, onCreated }: { projectId: number; onClose: () => void; onCreated: (c: IlalCase) => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const schema = z.object({ title: z.string().trim().min(1, t('ilal.new.titleRequired')).max(255), category: z.enum(DISCREPANCIES) })
  type Values = z.infer<typeof schema>
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { title: '', category: 'ikhtilaf_sanad' } })
  const create = useMutation({
    mutationFn: (v: Values) => createCase(projectId, { title: v.title.trim(), discrepancy_category: v.category }),
    onSuccess: async (made) => {
      await invalidate.ilalChanged(qc, projectId)
      onCreated(made)
    },
  })
  return (
    <Modal title={t('ilal.new.title')} onClose={onClose}>
      <form noValidate onSubmit={handleSubmit((v) => create.mutate(v))}>
        <Field label={t('ilal.new.titleLabel')} requirement="required" error={errors.title?.message} hint={t('ilal.new.titleHint')}>
          <input dir="auto" aria-invalid={errors.title ? true : undefined} {...register('title')} />
        </Field>
        <Field label={t('ilal.new.category')} requirement="required" hint={t('ilal.new.categoryHint')}>
          <select {...register('category')}>
            {DISCREPANCIES.map((d) => (
              <option key={d} value={d}>
                {t(`ilal.categories.${d}`)}
              </option>
            ))}
          </select>
        </Field>
        <MutationNotice error={create.error} title={t('ilal.new.failed')} />
        <div className={dialog.actions}>
          <Button onClick={onClose} disabled={create.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {t('ilal.new.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/** Add one version of the report to compare. The case is re-read before writing so a teammate's version is kept. */
export function AddVariantDialog({ projectId, kase, onClose }: { projectId: number; kase: IlalCase; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const schema = z.object({
    name: z
      .string()
      .trim()
      .min(1, t('ilal.variant.nameRequired'))
      .max(120)
      .refine((n) => !kase.competing_variants.some((v) => (v.name ?? '').trim() === n), t('ilal.variant.nameTaken')),
    matn: z.string(),
    chain: z.string(),
    note: z.string(),
  })
  type Values = z.infer<typeof schema>
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', matn: '', chain: '', note: '' } })
  const add = useMutation({
    mutationFn: (v: Values) => appendToCase(projectId, kase.id, { variant: { name: v.name.trim(), matn: v.matn.trim(), chain: v.chain.trim(), note: v.note.trim() } }),
    onSuccess: async () => {
      await invalidate.ilalChanged(qc, projectId)
      onClose()
    },
  })
  return (
    <Modal title={t('ilal.variant.title')} onClose={onClose} wide>
      <form noValidate onSubmit={handleSubmit((v) => add.mutate(v))}>
        <Field label={t('ilal.variant.name')} requirement="required" error={errors.name?.message} hint={t('ilal.variant.nameHint')}>
          <input dir="auto" aria-invalid={errors.name ? true : undefined} {...register('name')} />
        </Field>
        <Field label={t('ilal.variant.matn')} requirement="optional">
          <textarea rows={3} dir="auto" {...register('matn')} />
        </Field>
        <Field label={t('ilal.variant.chain')} requirement="optional" hint={t('ilal.variant.chainHint')}>
          <textarea rows={2} dir="auto" {...register('chain')} />
        </Field>
        <Field label={t('ilal.variant.note')} requirement="optional">
          <textarea rows={2} dir="auto" {...register('note')} />
        </Field>
        <MutationNotice error={add.error} title={t('ilal.variant.failed')} />
        <div className={dialog.actions}>
          <Button onClick={onClose} disabled={add.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={add.isPending}>
            {t('ilal.variant.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/** Record what a critic said, with where it was said. Nothing is checked against the corpus: the text is the researcher's. */
export function AddCriticDialog({ projectId, kase, onClose }: { projectId: number; kase: IlalCase; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const schema = z.object({ critic: z.string().trim().min(1, t('ilal.critic.whoRequired')).max(200), verdict: z.string().trim().min(1, t('ilal.critic.saidRequired')), source: z.string(), favours: z.string() })
  type Values = z.infer<typeof schema>
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { critic: '', verdict: '', source: '', favours: '' } })
  const add = useMutation({
    mutationFn: (v: Values) => appendToCase(projectId, kase.id, { critic: { critic: v.critic.trim(), verdict: v.verdict.trim(), source: v.source.trim(), favours: v.favours } }),
    onSuccess: async () => {
      await invalidate.ilalChanged(qc, projectId)
      onClose()
    },
  })
  return (
    <Modal title={t('ilal.critic.title')} onClose={onClose} wide>
      <form noValidate onSubmit={handleSubmit((v) => add.mutate(v))}>
        <Field label={t('ilal.critic.who')} requirement="required" error={errors.critic?.message}>
          <input dir="auto" aria-invalid={errors.critic ? true : undefined} {...register('critic')} />
        </Field>
        <Field label={t('ilal.critic.said')} requirement="required" error={errors.verdict?.message} hint={t('ilal.critic.saidHint')}>
          <textarea rows={3} dir="auto" aria-invalid={errors.verdict ? true : undefined} {...register('verdict')} />
        </Field>
        <Field label={t('ilal.critic.source')} requirement="optional" hint={t('ilal.critic.sourceHint')}>
          <input dir="auto" {...register('source')} />
        </Field>
        <Field label={t('ilal.critic.favours')} requirement="optional" hint={t('ilal.critic.favoursHint')}>
          <select {...register('favours')}>
            <option value="">{t('ilal.critic.favoursNone')}</option>
            {kase.competing_variants.map((v, i) => {
              const label = (v.name ?? '').trim() || `#${i + 1}`
              return (
                <option key={label} value={label}>
                  {label}
                </option>
              )
            })}
          </select>
        </Field>
        <MutationNotice error={add.error} title={t('ilal.critic.failed')} />
        <div className={dialog.actions}>
          <Button onClick={onClose} disabled={add.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={add.isPending}>
            {t('ilal.critic.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
