import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { resendVerification } from '@/api/auth'
import { ApiError, retryAfterSeconds } from '@/api/errors'
import { useAuth } from '@/app/authContext'
import { Notice } from '@/components/Field'
import { RegistrationPage } from './RegistrationPage'
import { formatClock, useCountdown } from './useCountdown'
import styles from './Registration.module.css'
import { errorMessage } from '@/api/errorMessage'

/** Where a freshly applied (or still unverified) account waits for the verification link. */
export function CheckEmailPage() {
  const location = useLocation()
  const { user } = useAuth()
  const email = (location.state as { email?: string } | null)?.email ?? user?.email
  if (!email) return <Navigate to="/apply" replace />
  return <CheckEmailCard email={email} />
}

/** Daily limit from the backend: 5 emails, 1 per minute. */
const DAILY_LIMIT = 5

export function CheckEmailCard({ email, initialWait = 60 }: { email: string; initialWait?: number }) {
  const { t } = useTranslation()
  const [wait, restartWait] = useCountdown(initialWait)
  const [remainingToday, setRemainingToday] = useState<number | null>(null)
  const [devLink, setDevLink] = useState<string | null>(null)

  const resend = useMutation({
    mutationFn: () => resendVerification(email),
    onSuccess: (data) => {
      restartWait(60)
      if (data?.remaining_today !== undefined) setRemainingToday(data.remaining_today)
      // Development convenience only: the backend currently returns the token (request file C-2).
      if (import.meta.env.DEV && data?.verification_token) {
        setDevLink(`/verify-email?token=${encodeURIComponent(data.verification_token)}`)
      }
    },
    onError: (err) => {
      const seconds = retryAfterSeconds(err)
      if (seconds) restartWait(seconds)
    },
  })

  // A wait of more than a few minutes means the daily limit, not the one-minute limit.
  const limitReached =
    resend.error instanceof ApiError &&
    resend.error.status === 429 &&
    (retryAfterSeconds(resend.error) ?? 0) > 300

  return (
    <RegistrationPage step={1}>
      <div>
        <h1>{t('registration.checkEmail.title')}</h1>
        <p className={styles.lead}>
          {t('registration.checkEmail.lead', { email })} {t('registration.checkEmail.expiry')}
        </p>
      </div>

      <div>
        <strong>{t('registration.checkEmail.didntGet')}</strong>
        <p className={styles.lead}>{t('registration.checkEmail.spam')}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => resend.mutate()}
            disabled={wait > 0 || resend.isPending || limitReached}
          >
            {t('registration.checkEmail.resend')}
          </button>
          {wait > 0 ? (
            <span className={styles.meta}>
              {t('registration.checkEmail.available', { clock: formatClock(wait) })}
              {remainingToday !== null
                ? ` · ${t('registration.checkEmail.usedToday', { used: DAILY_LIMIT - remainingToday })}`
                : ''}
            </span>
          ) : null}
        </div>
      </div>

      {resend.isSuccess ? <Notice>{t('registration.checkEmail.sent')}</Notice> : null}
      {resend.isError && !limitReached ? (
        <Notice dashed>
          {errorMessage(resend.error, t)}
        </Notice>
      ) : null}
      {limitReached ? <Notice dashed>{t('registration.checkEmail.dailyLimit')}</Notice> : null}

      {devLink ? (
        <Notice dashed>
          Dev only: <Link to={devLink}>open the verification link</Link>
        </Notice>
      ) : null}
    </RegistrationPage>
  )
}
