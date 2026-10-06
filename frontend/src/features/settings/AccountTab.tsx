import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { requestClosure } from '@/api/account'
import { invalidate } from '@/api/invalidate'
import type { Me } from '@/api/schemas/auth'
import { usePreferences } from '@/app/preferencesContext'
import { Button, ButtonLink } from '@/components/Button'
import { Field } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { MutationNotice } from '@/components/MutationNotice'
import { formatCode } from '@/domain/codes'
import styles from './Settings.module.css'

/** The account itself: its number, state, and how to ask for it to be closed. */
export function AccountTab({ me }: { me: Me }) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const [closing, setClosing] = useState(false)
  const owned = me.stats?.owned_projects_count

  return (
    <div className={styles.form}>
      <dl className={styles.facts}>
        <dt>{t('settings.account.id')}</dt>
        <dd>{formatCode('ACC', me.id)}</dd>
        <dt>{t('settings.account.email')}</dt>
        <dd>{me.email}</dd>
        <dt>{t('settings.account.status')}</dt>
        <dd>{t(`settings.account.statuses.${me.status}`, { defaultValue: me.status })}</dd>
      </dl>

      <section className={styles.section} aria-label={t('settings.account.closeTitle')}>
        <h2>{t('settings.account.closeTitle')}</h2>
        <p>{owned !== undefined ? t('settings.account.owns', { count: owned, formattedCount: n(owned) }) : null}</p>
        <p>{t('settings.account.closeBody')}</p>
        <div className={styles.saveBar}>
          <ButtonLink to="/downloads">{t('settings.account.download')}</ButtonLink>
          <Button variant="danger" onClick={() => setClosing(true)}>
            {t('settings.account.request')}
          </Button>
        </div>
      </section>

      {closing ? <ClosureDialog onClose={() => setClosing(false)} /> : null}
    </div>
  )
}

/** Asking for closure needs the password. When the server has it, the account is limited to the status page. */
function ClosureDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [password, setPassword] = useState('')
  const [reason, setReason] = useState('')

  const close = useMutation({
    mutationFn: () => requestClosure({ password, reason: reason.trim() }),
    onSuccess: () => invalidate.me(qc),
  })

  return (
    <Modal title={t('settings.account.dialogTitle')} onClose={onClose}>
      <form
        className={styles.dialogForm}
        onSubmit={(e) => {
          e.preventDefault()
          if (password) close.mutate()
        }}
      >
        <p>{t('settings.account.dialogBody')}</p>
        <Field label={t('settings.account.reason')} requirement="optional">
          <textarea rows={3} dir="auto" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Field label={t('settings.account.password')} requirement="required">
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <MutationNotice error={close.error} title={t('settings.account.failed')} />
        <div className={styles.dialogActions}>
          <Button onClick={onClose} disabled={close.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="danger" disabled={close.isPending || !password}>
            {t('settings.account.confirm')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
