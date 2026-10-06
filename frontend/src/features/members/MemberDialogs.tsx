import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { invalidate } from '@/api/invalidate'
import { changeMemberRole, leaveProject, removeMember } from '@/api/members'
import { Button } from '@/components/Button'
import { ConfirmAction } from '@/components/ConfirmAction'
import { Modal } from '@/components/Modal'
import { MutationNotice } from '@/components/MutationNotice'
import dialog from '@/components/Dialog.module.css'
import { GRANTABLE, type MemberRow } from './membersModel'
import { formCode } from './formCode'
import styles from './Members.module.css'

/** Change one member's role. The owner is not a choice: ownership moves by transfer. Mounted only while open. */
export function ChangeRoleDialog({ projectId, row, onClose }: { projectId: number; row: MemberRow; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [role, setRole] = useState<(typeof GRANTABLE)[number]>(row.role === 'owner' ? 'researcher' : row.role)
  const save = useMutation({
    mutationFn: () => changeMemberRole(projectId, row.userId, role),
    onSuccess: async () => {
      await invalidate.membersChanged(qc, projectId)
      onClose()
    },
  })
  return (
    <Modal title={t('members.roleDialog.title', { name: row.name })} onClose={onClose}>
      <fieldset className={styles.roleList}>
        <legend>{t('members.invite.role')}</legend>
        {GRANTABLE.map((r) => (
          <label key={r} className={styles.roleChoice}>
            <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} />
            <span>
              {t(`roles.${r}`)}
              <small>{t(`members.invite.roleHint.${r}`)}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <p className={styles.muted}>{t('members.roleDialog.note')}</p>
      <MutationNotice error={save.error} title={t('members.roleDialog.failed')} />
      <div className={dialog.actions}>
        <Button onClick={onClose} disabled={save.isPending}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" onClick={() => save.mutate()} disabled={save.isPending || role === row.role}>
          {t('members.changeRole')}
        </Button>
      </div>
    </Modal>
  )
}

/** Remove a member. What happens is stated as the server does it, and nothing it does not do. */
export function RemoveDialog({
  projectId,
  row,
  onClose,
  onChangeInstead,
}: {
  projectId: number
  row: MemberRow
  onClose: () => void
  onChangeInstead: () => void
}) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const remove = useMutation({
    mutationFn: () => removeMember(projectId, row.userId),
    onSuccess: async () => {
      await invalidate.membersChanged(qc, projectId)
      onClose()
    },
  })
  return (
    <Modal title={t('members.removeDialog.title', { name: row.name, code: formCode(projectId) })} onClose={onClose}>
      <ol>
        <li>{t('members.removeDialog.access')}</li>
        <li>{t('members.removeDialog.shared')}</li>
        <li>{t('members.removeDialog.tasks')}</li>
        <li>{t('members.removeDialog.private')}</li>
      </ol>
      <p>
        <Button variant="ghost" onClick={onChangeInstead}>
          {t('members.removeDialog.instead', { name: row.name })}
        </Button>
      </p>
      <MutationNotice error={remove.error} title={t('members.removeDialog.failed')} />
      <div className={dialog.actions}>
        <Button onClick={onClose} disabled={remove.isPending}>
          {t('common.cancel')}
        </Button>
        <Button variant="danger" onClick={() => remove.mutate()} disabled={remove.isPending}>
          {t('members.removeDialog.confirm', { name: row.name })}
        </Button>
      </div>
    </Modal>
  )
}

/** Leave the project yourself. The owner cannot (they must hand the project over first). */
export function LeaveDialog({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const leave = useMutation({
    mutationFn: () => leaveProject(projectId),
    onSuccess: async () => {
      await invalidate.projectLifecycle(qc)
      navigate('/projects', { replace: true })
    },
  })
  return (
    <ConfirmAction
      open
      danger
      busy={leave.isPending}
      title={t('members.leaveDialog.title', { code: formCode(projectId) })}
      confirmLabel={t('members.leaveDialog.confirm')}
      onConfirm={() => leave.mutate()}
      onCancel={onClose}
    >
      <p>{t('members.leaveDialog.body')}</p>
      <MutationNotice error={leave.error} title={t('members.leaveDialog.failed')} />
    </ConfirmAction>
  )
}

