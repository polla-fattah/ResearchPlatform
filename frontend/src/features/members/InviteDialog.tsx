import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { invalidate } from '@/api/invalidate'
import { createInvitation, INVITATION_DAYS } from '@/api/members'
import { INVITABLE_ROLES, type InvitableRole } from '@/api/schemas/members'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { MutationNotice } from '@/components/MutationNotice'
import { formCode } from './formCode'
import { invitationLink } from './membersModel'
import { CopyLink } from './CopyLink'
import dialog from '@/components/Dialog.module.css'
import styles from './Members.module.css'

/**
 * Invite someone by the e-mail address of their account. The server sends no e-mail, so once the invitation exists
 * the dialog hands over its link for the owner to pass on (request file C-22). Mounted only while open: its draft
 * is gone when it closes.
 */
export function InviteDialog({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()

  const schema = z.object({
    email: z.string().trim().min(1, t('members.invite.emailRequired')).email(t('members.invite.emailInvalid')),
    role: z.enum(INVITABLE_ROLES),
  })
  type Values = z.infer<typeof schema>
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', role: 'researcher' } })

  const send = useMutation({
    mutationFn: (v: Values) => createInvitation(projectId, { email: v.email.trim(), role: v.role as InvitableRole }),
    onSuccess: () => invalidate.membersChanged(qc, projectId),
  })

  if (send.data) {
    const link = send.data.token ? invitationLink(window.location.origin, send.data.token) : null
    return (
      <Modal title={t('members.invite.sentTitle')} onClose={onClose}>
        <p>{t('members.invite.sentBody', { email: send.data.email, days: INVITATION_DAYS })}</p>
        <p>{t('members.invite.noEmail')}</p>
        {link ? <CopyLink link={link} /> : null}
        <div className={dialog.actions}>
          <Button variant="primary" onClick={onClose}>
            {t('members.invite.done')}
          </Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title={t('members.invite.title', { code: formCode(projectId) })} onClose={onClose}>
      <form noValidate onSubmit={handleSubmit((v) => send.mutate(v))}>
        <Field label={t('members.invite.email')} requirement="required" error={errors.email?.message} hint={t('members.invite.emailHint')}>
          <input type="email" dir="ltr" autoComplete="off" aria-invalid={errors.email ? true : undefined} {...register('email')} />
        </Field>
        <fieldset className={styles.roleList}>
          <legend>{t('members.invite.role')}</legend>
          {INVITABLE_ROLES.map((r) => (
            <label key={r} className={styles.roleChoice}>
              <input type="radio" value={r} {...register('role')} />
              <span>
                {t(`roles.${r}`)}
                <small>{t(`members.invite.roleHint.${r}`)}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <p className={styles.muted}>{t('members.invite.shows', { days: INVITATION_DAYS })}</p>
        <MutationNotice error={send.error} title={t('members.invite.failed')} />
        <div className={dialog.actions}>
          <Button onClick={onClose} disabled={send.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={send.isPending}>
            {send.isPending ? t('members.invite.sending') : t('members.invite.send')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
