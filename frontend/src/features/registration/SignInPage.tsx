import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { z } from 'zod'
import { ApiError, retryAfterSeconds } from '@/api/errors'
import { session } from '@/api/http'
import { useAuth } from '@/app/authContext'
import { Button } from '@/components/Button'
import { ErrorSummary, Field, Notice } from '@/components/Field'
import { RegistrationPage } from './RegistrationPage'
import styles from './Registration.module.css'
import { errorMessage } from '@/api/errorMessage'

type Problem =
  | { kind: 'credentials' }
  | { kind: 'paused'; minutes: number }
  | { kind: 'suspended' }
  | { kind: 'other'; message: string }

/** The second step for an account with two-step sign-in: the code from the authenticator app, or a recovery code. */
function TwoStep({ challengeToken, onRestart }: { challengeToken: string; onRestart: () => void }) {
  const { t } = useTranslation()
  const { completeMfa } = useAuth()
  const [code, setCode] = useState('')
  const verify = useMutation({ mutationFn: () => completeMfa(challengeToken, code.trim()) })

  return (
    <RegistrationPage step={4}>
      <div>
        <h1>{t('registration.signIn.twoStep.title')}</h1>
        <p>{t('registration.signIn.twoStep.body')}</p>
      </div>
      {verify.error ? <ErrorSummary title={t('registration.signIn.twoStep.wrong')} items={[t('registration.signIn.twoStep.wrongHint')]} /> : null}
      <form
        className={styles.form}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (code.trim()) verify.mutate()
        }}
      >
        <Field label={t('registration.signIn.twoStep.code')} hint={t('registration.signIn.twoStep.hint')}>
          <input autoComplete="one-time-code" autoFocus value={code} disabled={verify.isPending} onChange={(e) => setCode(e.target.value)} />
        </Field>
        <div className={styles.actions}>
          <Button type="submit" variant="primary" disabled={verify.isPending || !code.trim()}>
            {verify.isPending ? t('registration.signIn.submitting') : t('registration.signIn.twoStep.verify')}
          </Button>
          <Button variant="ghost" onClick={onRestart}>
            {t('registration.signIn.twoStep.restart')}
          </Button>
        </div>
      </form>
    </RegistrationPage>
  )
}

export function SignInPage() {
  const { t } = useTranslation()
  const { status, signIn } = useAuth()
  const location = useLocation()
  // Read once: shown when the previous session ended with a 401.
  const [expired] = useState(() => session.consumeExpired())
  const [problem, setProblem] = useState<Problem | null>(null)
  const [challenge, setChallenge] = useState<string | null>(null)

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
  if (challenge) return <TwoStep challengeToken={challenge} onRestart={() => setChallenge(null)} />

  const onSubmit = async (values: Values) => {
    setProblem(null)
    try {
      const outcome = await signIn(values.email, values.password)
      if (outcome.kind === 'mfa') setChallenge(outcome.challengeToken)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          const seconds = retryAfterSeconds(err) ?? 900
          return setProblem({ kind: 'paused', minutes: Math.max(1, Math.ceil(seconds / 60)) })
        }
        if (err.code === 'ACCOUNT_SUSPENDED') return setProblem({ kind: 'suspended' })
        if (err.status === 401) return setProblem({ kind: 'credentials' })
        return setProblem({ kind: 'other', message: errorMessage(err, t) })
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
