import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { z } from 'zod'
import { ApiError, retryAfterSeconds, userMessage } from '@/api/errors'
import { session } from '@/api/http'
import { useAuth } from '@/app/authContext'
import { Button } from '@/components/Button'
import { ErrorSummary, Field, Notice } from '@/components/Field'
import { RegistrationPage } from './RegistrationPage'
import styles from './Registration.module.css'

type Problem =
  | { kind: 'credentials' }
  | { kind: 'paused'; minutes: number }
  | { kind: 'suspended' }
  | { kind: 'mfa' }
  | { kind: 'other'; message: string }

export function SignInPage() {
  const { t } = useTranslation()
  const { status, signIn } = useAuth()
  const location = useLocation()
  // Read once: shown when the previous session ended with a 401.
  const [expired] = useState(() => session.consumeExpired())
  const [problem, setProblem] = useState<Problem | null>(null)

  const schema = z.object({
    email: z.email(t('registration.apply.errors.email')),
    password: z.string().min(1, t('registration.signIn.errors.password')),
  })
  type Values = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  if (status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from ?? '/home'
    return <Navigate to={from} replace />
  }

  const onSubmit = async (values: Values) => {
    setProblem(null)
    try {
      const outcome = await signIn(values.email, values.password)
      if (outcome === 'mfa') setProblem({ kind: 'mfa' })
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          const seconds = retryAfterSeconds(err) ?? 900
          return setProblem({ kind: 'paused', minutes: Math.max(1, Math.ceil(seconds / 60)) })
        }
        if (err.code === 'ACCOUNT_SUSPENDED') return setProblem({ kind: 'suspended' })
        if (err.status === 401) return setProblem({ kind: 'credentials' })
        return setProblem({ kind: 'other', message: userMessage(err, t('states.error.body')) })
      }
      setProblem({ kind: 'other', message: t('states.error.body') })
    }
  }

  return (
    <RegistrationPage step={4}>
      <div>
        <h1>{t('common.signIn')}</h1>
      </div>

      {expired ? (
        <Notice>
          <strong>{t('registration.signIn.signedOut')}</strong> {t('registration.signIn.signedOutBody')}
        </Notice>
      ) : null}

      {problem?.kind === 'credentials' ? (
        <ErrorSummary
          title={t('registration.signIn.mismatch')}
          items={[t('registration.signIn.mismatchHint')]}
        />
      ) : null}
      {problem?.kind === 'paused' ? (
        <ErrorSummary
          title={t('registration.signIn.pausedTitle')}
          items={[t('registration.signIn.pausedBody', { count: problem.minutes })]}
        />
      ) : null}
      {problem?.kind === 'suspended' ? (
        <ErrorSummary title={t('registration.signIn.suspended')} />
      ) : null}
      {problem?.kind === 'mfa' ? (
        <ErrorSummary title={t('registration.signIn.mfaUnavailable')} />
      ) : null}
      {problem?.kind === 'other' ? (
        <ErrorSummary title={t('states.error.title')} items={[problem.message]} />
      ) : null}

      <form className={styles.form} noValidate onSubmit={handleSubmit(onSubmit)}>
        <Field label={t('registration.fields.email')} error={errors.email?.message}>
          <input
            type="email"
            autoComplete="username"
            disabled={isSubmitting}
            aria-invalid={errors.email ? true : undefined}
            {...register('email')}
          />
        </Field>
        <Field label={t('registration.fields.password')} error={errors.password?.message}>
          <input
            type="password"
            autoComplete="current-password"
            disabled={isSubmitting}
            aria-invalid={errors.password ? true : undefined}
            {...register('password')}
          />
        </Field>
        <div className={styles.actions}>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? t('registration.signIn.submitting') : t('common.signIn')}
          </Button>
          <Link to="/recover" className={styles.linkButton}>
            {t('registration.signIn.forgot')}
          </Link>
        </div>
      </form>

      <div className={styles.meta}>
        {t('registration.signIn.noAccount')}{' '}
        <Link to="/apply">{t('registration.signIn.applyLink')}</Link>
      </div>
    </RegistrationPage>
  )
}
