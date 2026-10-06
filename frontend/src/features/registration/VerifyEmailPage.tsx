import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { resendVerification, verifyEmail } from '@/api/auth'
import { userMessage } from '@/api/errors'

import { useAuth } from '@/app/authContext'
import { Button, ButtonLink } from '@/components/Button'
import { Field, Notice } from '@/components/Field'
import { RegistrationPage } from './RegistrationPage'
import styles from './Registration.module.css'

/**
 * Opens from the emailed link: /verify-email?token=...
 * The token is single use, so the request runs through react-query (one call even under
 * StrictMode's double mount); a second call would answer 410 and wrongly show "no longer works".
 */
export function VerifyEmailPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { status } = useAuth()
  const qc = useQueryClient()

  const check = useQuery({
    queryKey: ['verify-email', token],
    queryFn: async () => {
      await verifyEmail(token)
      await qc.invalidateQueries({ queryKey: ['auth', 'me'] })
      await qc.invalidateQueries({ queryKey: ['application', 'my-status'] })
      return true
    },
    enabled: token !== '',
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  })

  if (check.isPending && token !== '') {
    return (
      <RegistrationPage step={1}>
        <h1>{t('registration.verify.checking')}</h1>
        <div className={styles.bar} role="progressbar" aria-label={t('registration.verify.checking')}>
          <span className={styles.barFill} />
        </div>
        <p className={styles.lead}>{t('registration.verify.checkingHint')}</p>
      </RegistrationPage>
    )
  }

  if (check.isSuccess) {
    return (
      <RegistrationPage step={2}>
        <div>
          <h1>{t('registration.verify.done')}</h1>
          <p className={styles.lead}>{t('registration.verify.doneBody')}</p>
        </div>
        <div className={styles.actions}>
          <ButtonLink variant="primary" to={status === 'authenticated' ? '/status' : '/sign-in'}>
            {status === 'authenticated' ? t('registration.verify.viewStatus') : t('common.signIn')}
          </ButtonLink>
        </div>
      </RegistrationPage>
    )
  }

  return <ExpiredLink />
}

function ExpiredLink() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const resend = useMutation({ mutationFn: () => resendVerification(email) })

  return (
    <RegistrationPage step={1}>
      <div>
        <h1>{t('registration.verify.expiredTitle')}</h1>
        <p className={styles.lead}>{t('registration.verify.expiredBody')}</p>
      </div>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault()
          if (email.trim()) resend.mutate()
        }}
      >
        <Field label={t('registration.fields.email')}>
          <input
            type="email"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <div className={styles.actions}>
          <Button type="submit" variant="primary" disabled={resend.isPending || !email.trim()}>
            {t('registration.verify.sendNew')}
          </Button>
        </div>
      </form>
      {resend.isSuccess ? <Notice>{t('registration.checkEmail.sent')}</Notice> : null}
      {resend.isError ? (
        <Notice dashed>
          {userMessage(resend.error, t('states.error.body'))}
        </Notice>
      ) : null}
    </RegistrationPage>
  )
}
