import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { resolveThread } from '@/api/discussion'
import { invalidate } from '@/api/invalidate'
import type { Thread } from '@/api/schemas/discussion'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { MutationNotice } from '@/components/MutationNotice'
import { formatCode } from '@/domain/codes'
import dialog from '@/components/Dialog.module.css'

/**
 * Record the decision that closes a discussion. The decision and its reason are required (the server asks for at least
 * three characters); an alternative reading can be kept beside it. It never changes a corpus record, and the dialog says so.
 */
export function ResolveDialog({ projectId, thread, onClose }: { projectId: number; thread: Thread; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const schema = z.object({
    decision: z.string().trim().min(3, t('discussion.resolve.decisionShort')),
    alternative: z.string(),
  })
  type Values = z.infer<typeof schema>
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { decision: '', alternative: '' } })

  const resolve = useMutation({
    mutationFn: (v: Values) => resolveThread(thread.id, { resolution_notes: v.decision.trim(), alternative_interpretation: v.alternative.trim() }),
    onSuccess: async () => {
      await invalidate.discussionChanged(qc, projectId)
      onClose()
    },
  })

  return (
    <Modal title={t('discussion.resolve.title', { code: formatCode('D', thread.id) })} onClose={onClose} wide>
      <form noValidate onSubmit={handleSubmit((v) => resolve.mutate(v))}>
        <p>
          <strong>{thread.title}</strong>
        </p>
        <Field label={t('discussion.resolve.decision')} requirement="required" error={errors.decision?.message} hint={t('discussion.resolve.decisionHint')}>
          <textarea rows={4} dir="auto" aria-invalid={errors.decision ? true : undefined} {...register('decision')} />
        </Field>
        <Field label={t('discussion.resolve.alternative')} requirement="optional" hint={t('discussion.resolve.alternativeHint')}>
          <textarea rows={3} dir="auto" {...register('alternative')} />
        </Field>
        <p>{t('discussion.resolve.note')}</p>
        <MutationNotice error={resolve.error} title={t('discussion.resolve.failed')} />
        <div className={dialog.actions}>
          <Button onClick={onClose} disabled={resolve.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={resolve.isPending}>
            {t('discussion.resolve.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
