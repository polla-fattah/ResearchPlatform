import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { confirmMfa, disableMfa, startMfa } from '@/api/account'
import { invalidate } from '@/api/invalidate'
import type { Me } from '@/api/schemas/auth'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { MutationNotice } from '@/components/MutationNotice'
import { groupSecret } from './settingsModel'
import styles from './Settings.module.css'

/**
 * Two-step sign-in. Turning it on is three steps: ask the server for a secret, type it into an authenticator app, and
 * prove it works with the first code. Only then is it on, and only then are the recovery codes made. They are shown
 * once, here, and the server cannot show them again, so the person must say they have kept them before this closes.
 */
export function MfaSection({ me }: { me: Me }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [code, setCode] = useState('')
  const [kept, setKept] = useState(false)
  const [turningOff, setTurningOff] = useState(false)

  const start = useMutation({ mutationFn: startMfa })
  const confirm = useMutation({
    mutationFn: () => confirmMfa(code.trim()),
    onSuccess: () => invalidate.me(qc),
  })

  const on = me.mfa_enabled === true
  const codes = confirm.data?.recovery_codes

  // Right after confirming, the account is on, but the codes still have to be kept.
  if (codes && !kept) {
    return (
      <section className={styles.section} aria-label={t('settings.mfa.title')}>
        <h2>{t('settings.mfa.title')}</h2>
        <p className={styles.success} role="status">
          {t('settings.mfa.nowOn')}
        </p>
        <h3>{t('settings.mfa.codesTitle')}</h3>
        <p>{t('settings.mfa.codesBody')}</p>
        <ul className={styles.codes} aria-label={t('settings.mfa.codesTitle')}>
          {codes.map((c) => (
            <li key={c} className="mono">
              {c}
            </li>
          ))}
        </ul>
        <Button variant="primary" onClick={() => setKept(true)}>
          {t('settings.mfa.codesKept')}
        </Button>
      </section>
    )
  }

  return (
    <section className={styles.section} aria-label={t('settings.mfa.title')}>
      <h2>{t('settings.mfa.title')}</h2>
      <p>{on ? t('settings.mfa.on') : t('settings.mfa.off')}</p>
      <p className={styles.hint}>{t('settings.mfa.about')}</p>

      {on ? (
        <Button onClick={() => setTurningOff(true)}>{t('settings.mfa.turnOff')}</Button>
      ) : start.data ? (
        <form
          className={styles.form}
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            if (code.trim().length === 6) confirm.mutate()
          }}
        >
          <p>{t('settings.mfa.step1')}</p>
          <p className={['mono', styles.secret].join(' ')} aria-label={t('settings.mfa.secret')}>
            {groupSecret(start.data.secret)}
          </p>
          <p className={styles.hint}>
            <a href={start.data.otpauth_url}>{t('settings.mfa.openApp')}</a>
          </p>
          <Field label={t('settings.mfa.code')} hint={t('settings.mfa.step2')}>
            <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <MutationNotice error={confirm.error} title={t('settings.mfa.confirmFailed')} />
          <div className={styles.saveBar}>
            <Button type="submit" variant="primary" disabled={confirm.isPending || code.length !== 6}>
              {confirm.isPending ? t('settings.saving') : t('settings.mfa.confirm')}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <MutationNotice error={start.error} title={t('settings.mfa.startFailed')} />
          <Button variant="primary" disabled={start.isPending} onClick={() => start.mutate()}>
            {t('settings.mfa.turnOn')}
          </Button>
        </>
      )}

      {turningOff ? (
        <TurnOffDialog
          onClose={() => setTurningOff(false)}
          onOff={() => {
            // Starting again needs a new secret, so nothing of the old attempt is kept.
            start.reset()
            confirm.reset()
            setKept(false)
            setCode('')
          }}
        />
      ) : null}
    </section>
  )
}

function TurnOffDialog({ onClose, onOff }: { onClose: () => void; onOff: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [password, setPassword] = useState('')

  const off = useMutation({
    mutationFn: () => disableMfa({ password }),
    onSuccess: async () => {
      onOff()
      await invalidate.me(qc)
      onClose()
    },
  })

  return (
    <Modal title={t('settings.mfa.offTitle')} onClose={onClose}>
      <form
        className={styles.dialogForm}
        onSubmit={(e) => {
          e.preventDefault()
          if (password) off.mutate()
        }}
      >
        <p>{t('settings.mfa.offBody')}</p>
        <Field label={t('settings.mfa.password')}>
          <input type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <MutationNotice error={off.error} title={t('settings.mfa.offFailed')} />
        <div className={styles.dialogActions}>
          <Button onClick={onClose} disabled={off.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="danger" disabled={off.isPending || !password}>
            {t('settings.mfa.offConfirm')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
