import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { forgotPassword } from '@/api/auth'
import { ApiError, retryAfterSeconds } from '@/api/errors'
import { Button } from '@/components/Button'
import { ErrorSummary, Field, Notice } from '@/components/Field'
import { RegistrationPage } from './RegistrationPage'
import styles from './Registration.module.css'

/** Recovery never reveals whether an address belongs to an account (ACC-04). */
export function RecoverPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const send = useMutation({ mutationFn: () => forgotPassword(email.trim()) })

  if (send.isSuccess) {
    return (
      <RegistrationPage step={4}>
        <div>
          <h1>{t('registration.recover.checkTitle')}</h1>
          <p className={styles.lead}>{t('registration.recover.checkBody', { email: email.trim() })}</p>
        </div>
        <div className={styles.actions}>
          <Link to="/sign-in">{t('registration.recover.back')}</Link>
        </div>
      </RegistrationPage>
    )
  }

  const limited = send.error instanceof ApiError && send.error.status === 429
  const minutes = Math.max(1, Math.ceil((retryAfterSeconds(send.error) ?? 600) / 60))

  return (
    <RegistrationPage step={4}>
      <div>
        <h1>{t('registration.recover.title')}</h1>
        <p className={styles.lead}>{t('registration.recover.lead')}</p>
      </div>

      {limited ? (
        <ErrorSummary
          title={t('registration.recover.tooMany', { count: minutes })}
          footer={t('registration.recover.emailKept')}
        />
      ) : send.isError ? (
        <ErrorSummary title={t('states.error.title')} items={[t('states.error.body')]} />
      ) : null}

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault()
          if (email.trim()) send.mutate()
        }}
      >
        <Field label={t('registration.fields.email')}>
          <input
            type="email"
            value={email}
            autoComplete="username"
            disabled={send.isPending}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <div className={styles.actions}>
          <Button type="submit" variant="primary" disabled={send.isPending || !email.trim()}>
            {send.isPending ? t('registration.recover.sending') : t('registration.recover.send')}
          </Button>
          <Link to="/sign-in" className={styles.linkButton}>
            {t('registration.recover.back')}
          </Link>
        </div>
      </form>
      <Notice dashed>{t('registration.recover.noEmailYet')}</Notice>
    </RegistrationPage>
  )
}
