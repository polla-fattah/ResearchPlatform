import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { addCorrigendum, releasePublication, retractPublication } from '@/api/editorial'
import { invalidate } from '@/api/invalidate'
import type { EditorSubmission } from '@/api/schemas/editorial'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { MutationNotice } from '@/components/MutationNotice'
import { formatCode } from '@/domain/codes'
import { isValidSlug, slugify } from '@/features/announcement/announcementModel'
import dialog from '@/components/Dialog.module.css'
import { releaseConfirmed } from './editorialModel'

/**
 * Release an approved package as a public publication. The address must be a valid slug (the server also needs it to be
 * unused); the code of the package is typed to confirm. The DOI is optional, and the form says what leaving it empty does:
 * the server then makes an internal identifier that is not a registered DOI (request file C-30).
 */
export function ReleaseDialog({ submission, onClose }: { submission: EditorSubmission; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const code = formatCode('SUB', submission.id)
  const schema = z.object({
    slug: z.string().trim().refine(isValidSlug, t('editorial.release.slugInvalid')),
    version: z.string().trim().min(1, t('editorial.release.versionRequired')).max(50),
    doi: z.string().trim().max(100),
    licence: z.string().trim().max(100),
    typed: z.string().refine((v) => releaseConfirmed(v, code), t('editorial.release.typeCode', { code })),
  })
  type Values = z.infer<typeof schema>
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { slug: slugify(submission.title), version: '1.0.0', doi: '', licence: submission.rights_declaration ?? '', typed: '' } })

  const release = useMutation({
    mutationFn: (v: Values) => releasePublication(submission.id, { public_slug: v.slug.trim(), version_string: v.version.trim(), doi: v.doi.trim(), license: v.licence.trim() }),
    onSuccess: async () => {
      await invalidate.editorialChanged(qc, submission.id)
      onClose()
    },
  })

  return (
    <Modal title={t('editorial.release.title', { code })} onClose={onClose} wide>
      <form noValidate onSubmit={handleSubmit((v) => release.mutate(v))}>
        <p>{t('editorial.release.body')}</p>
        <Field label={t('editorial.release.slug')} requirement="required" error={errors.slug?.message} hint={t('editorial.release.slugHint')}>
          <input dir="ltr" {...register('slug')} />
        </Field>
        <Field label={t('editorial.release.version')} requirement="required" error={errors.version?.message}>
          <input dir="ltr" {...register('version')} />
        </Field>
        <Field label={t('editorial.release.licence')} requirement="optional" hint={t('editorial.release.licenceHint')}>
          <input dir="ltr" {...register('licence')} />
        </Field>
        <Field label={t('editorial.release.doi')} requirement="optional" hint={t('editorial.release.doiHint')}>
          <input dir="ltr" {...register('doi')} />
        </Field>
        <Field label={t('editorial.release.type', { code })} requirement="required" error={errors.typed?.message}>
          <input dir="ltr" autoComplete="off" {...register('typed')} />
        </Field>
        <MutationNotice error={release.error} title={t('editorial.release.failed')} />
        <div className={dialog.actions}>
          <Button onClick={onClose} disabled={release.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={release.isPending}>
            {t('editorial.release.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/** Add a correction notice to a published package; it moves the publication to a new version string. */
export function CorrigendumDialog({ submissionId, publicationId, current, onClose }: { submissionId: number; publicationId: number; current: string; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const schema = z.object({
    notice: z.string().trim().min(10, t('editorial.corrigendum.noticeShort')),
    version: z.string().trim().min(1, t('editorial.release.versionRequired')).max(50).refine((v) => v !== current, t('editorial.corrigendum.versionSame')),
  })
  type Values = z.infer<typeof schema>
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { notice: '', version: '' } })
  const add = useMutation({
    mutationFn: (v: Values) => addCorrigendum(publicationId, { notice: v.notice.trim(), new_version_string: v.version.trim() }),
    onSuccess: async () => {
      await invalidate.editorialChanged(qc, submissionId)
      onClose()
    },
  })
  return (
    <Modal title={t('editorial.corrigendum.title')} onClose={onClose}>
      <form noValidate onSubmit={handleSubmit((v) => add.mutate(v))}>
        <p>{t('editorial.corrigendum.body', { version: current })}</p>
        <Field label={t('editorial.corrigendum.notice')} requirement="required" error={errors.notice?.message} hint={t('editorial.corrigendum.noticeHint')}>
          <textarea rows={4} dir="auto" {...register('notice')} />
        </Field>
        <Field label={t('editorial.corrigendum.version')} requirement="required" error={errors.version?.message}>
          <input dir="ltr" {...register('version')} />
        </Field>
        <MutationNotice error={add.error} title={t('editorial.corrigendum.failed')} />
        <div className={dialog.actions}>
          <Button onClick={onClose} disabled={add.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={add.isPending}>
            {t('editorial.corrigendum.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/** Retract a publication. The reason is public, so it is required and says so; the page stays up marked retracted. */
export function RetractDialog({ submissionId, publicationId, onClose }: { submissionId: number; publicationId: number; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [reason, setReason] = useState('')
  const retract = useMutation({
    mutationFn: () => retractPublication(publicationId, reason.trim()),
    onSuccess: async () => {
      await invalidate.editorialChanged(qc, submissionId)
      onClose()
    },
  })
  const short = reason.trim().length < 10
  return (
    <Modal title={t('editorial.retract.title')} onClose={onClose}>
      <p>{t('editorial.retract.body')}</p>
      <Field label={t('editorial.retract.reason')} requirement="required" hint={t('editorial.retract.reasonHint')}>
        <textarea rows={4} dir="auto" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <MutationNotice error={retract.error} title={t('editorial.retract.failed')} />
      <div className={dialog.actions}>
        <Button onClick={onClose} disabled={retract.isPending}>
          {t('common.cancel')}
        </Button>
        <Button variant="danger" onClick={() => retract.mutate()} disabled={retract.isPending || short}>
          {t('editorial.retract.submit')}
        </Button>
      </div>
    </Modal>
  )
}
