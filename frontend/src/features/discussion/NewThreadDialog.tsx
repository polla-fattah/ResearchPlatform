import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { createThread } from '@/api/discussion'
import { invalidate } from '@/api/invalidate'
import type { Thread, TargetType } from '@/api/schemas/discussion'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { MutationNotice } from '@/components/MutationNotice'
import dialog from '@/components/Dialog.module.css'

export interface Target {
  type: TargetType
  id: number
}

/**
 * Open a discussion about the project or, when it is opened from an item's own screen, about that item. The target is
 * stated, not chosen here: other items start their discussion from where they are shown. Mounted only while open.
 */
export function NewThreadDialog({ projectId, target, onClose, onCreated }: { projectId: number; target: Target; onClose: () => void; onCreated: (t: Thread) => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const schema = z.object({
    title: z.string().trim().min(1, t('discussion.new.titleRequired')).max(500),
    comment: z.string().trim().min(1, t('discussion.new.commentRequired')),
  })
  type Values = z.infer<typeof schema>
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { title: '', comment: '' } })

  const create = useMutation({
    mutationFn: (v: Values) => createThread(projectId, { title: v.title.trim(), target_type: target.type, target_id: target.id, initial_comment: v.comment.trim() }),
    onSuccess: async (thread) => {
      await invalidate.discussionChanged(qc, projectId)
      onCreated(thread)
    },
  })

  return (
    <Modal title={t('discussion.new.title')} onClose={onClose} wide>
      <form noValidate onSubmit={handleSubmit((v) => create.mutate(v))}>
        <p>{t('discussion.new.about', { target: t(`discussion.targets.${target.type}`, { id: target.id }) })}</p>
        <Field label={t('discussion.new.titleLabel')} requirement="required" error={errors.title?.message}>
          <input dir="auto" aria-invalid={errors.title ? true : undefined} {...register('title')} />
        </Field>
        <Field label={t('discussion.new.comment')} requirement="required" error={errors.comment?.message} hint={t('discussion.new.visible')}>
          <textarea rows={5} dir="auto" aria-invalid={errors.comment ? true : undefined} {...register('comment')} />
        </Field>
        <MutationNotice error={create.error} title={t('discussion.new.failed')} />
        <div className={dialog.actions}>
          <Button onClick={onClose} disabled={create.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {t('discussion.new.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
