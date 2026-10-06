import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { decideClosure, setRoles, setStatus } from '@/api/admin'
import { invalidate } from '@/api/invalidate'
import type { AdminUser, ClosureRequest, PlatformRole } from '@/api/schemas/admin'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { MutationNotice } from '@/components/MutationNotice'
import { accountCode, ROLE_ORDER, settableRoles } from './adminModel'
import styles from './Admin.module.css'

/** What the server asks of a reason for a status change (`min:3`). */
const MIN_STATUS_REASON = 3

/** Change an account's platform roles. Giving the administrator role is named for what it is. */
export function RoleDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [roles, setPicked] = useState<PlatformRole[]>(settableRoles(user.roles))

  const save = useMutation({
    mutationFn: () => setRoles(user.id, roles),
    onSuccess: async () => {
      await invalidate.adminUsersChanged(qc)
      onClose()
    },
  })
  const toggle = (role: PlatformRole) => setPicked((current) => (current.includes(role) ? current.filter((r) => r !== role) : [...current, role]))
  const grantsAdmin = roles.includes('admin') && !user.is_admin
  const changed = roles.length !== settableRoles(user.roles).length || roles.some((r) => !user.roles.includes(r))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (roles.length > 0 && changed) save.mutate()
  }

  return (
    <Modal title={t('admin.accounts.role.title', { name: user.display_name })} onClose={onClose}>
      <form className={styles.dialogForm} onSubmit={submit}>
        <fieldset className={styles.checks}>
          <legend>{t('admin.accounts.role.legend')}</legend>
          {ROLE_ORDER.map((role) => (
            <label key={role}>
              <input type="checkbox" checked={roles.includes(role)} onChange={() => toggle(role)} />
              {t(`admin.roles.${role}`)}
            </label>
          ))}
        </fieldset>
        {roles.length === 0 ? <p className={styles.hint}>{t('admin.accounts.role.needOne')}</p> : null}
        {grantsAdmin ? (
          <p className={styles.warnBox} role="note">
            {t('admin.accounts.role.adminWarning')}
          </p>
        ) : null}
        <p className={styles.hint}>{t('admin.accounts.role.recorded')}</p>
        <MutationNotice error={save.error} title={t('admin.accounts.role.failed')} />
        <div className={styles.dialogActions}>
          <Button onClick={onClose} disabled={save.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={save.isPending || roles.length === 0 || !changed}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/** Suspend an account, or give it back. Both need a reason, which goes into the audit log. */
export function StatusDialog({ user, action, onClose }: { user: AdminUser; action: 'suspend' | 'reactivate'; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [reason, setReason] = useState('')

  const save = useMutation({
    mutationFn: () => setStatus(user.id, action === 'suspend' ? 'suspended' : 'approved', reason.trim()),
    onSuccess: async () => {
      await invalidate.adminUsersChanged(qc)
      onClose()
    },
  })
  const ok = reason.trim().length >= MIN_STATUS_REASON

  return (
    <Modal title={t(`admin.accounts.${action}.title`, { name: user.display_name })} onClose={onClose}>
      <form
        className={styles.dialogForm}
        onSubmit={(e) => {
          e.preventDefault()
          if (ok) save.mutate()
        }}
      >
        <p>{t(`admin.accounts.${action}.body`)}</p>
        <p className={styles.hint}>
          <BidiText>{user.display_name}</BidiText> · {accountCode(user.id)} · {user.email}
        </p>
        <Field label={t('admin.accounts.reason')} requirement="required" hint={t('admin.accounts.reasonHint')}>
          <textarea rows={3} dir="auto" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <MutationNotice error={save.error} title={t(`admin.accounts.${action}.failed`)} />
        <div className={styles.dialogActions}>
          <Button onClick={onClose} disabled={save.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant={action === 'suspend' ? 'danger' : 'primary'} disabled={save.isPending || !ok}>
            {t(`admin.accounts.${action}.confirm`)}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/** Decide an account closure request. Approving closes the account and signs it out; what happens to its projects is not decided here. */
export function ClosureDialog({ request, onClose }: { request: ClosureRequest; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [reason, setReason] = useState('')

  const decide = useMutation({
    mutationFn: (decision: 'approved' | 'rejected') => decideClosure(request.id, decision, reason.trim()),
    onSuccess: async () => {
      await invalidate.adminUsersChanged(qc)
      onClose()
    },
  })

  return (
    <Modal title={t('admin.accounts.closure.title', { name: request.display_name })} onClose={onClose}>
      <div className={styles.dialogForm}>
        <p>{t('admin.accounts.closure.body')}</p>
        {request.closure_reason ? (
          <p>
            <BidiText>{request.closure_reason}</BidiText>
          </p>
        ) : null}
        <Field label={t('admin.accounts.closure.reason')}>
          <textarea rows={2} dir="auto" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <MutationNotice error={decide.error} title={t('admin.accounts.closure.failed')} />
        <div className={styles.dialogActions}>
          <Button onClick={onClose} disabled={decide.isPending}>
            {t('common.cancel')}
          </Button>
          <Button disabled={decide.isPending} onClick={() => decide.mutate('rejected')}>
            {t('admin.accounts.closure.reject')}
          </Button>
          <Button variant="danger" disabled={decide.isPending} onClick={() => decide.mutate('approved')}>
            {t('admin.accounts.closure.approve')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
