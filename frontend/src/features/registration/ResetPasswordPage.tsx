import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { resetPassword } from '@/api/auth'
import { ApiError } from '@/api/errors'
import { Button, ButtonLink } from '@/components/Button'
import { ErrorSummary, Field } from '@/components/Field'
import { RegistrationPage } from './RegistrationPage'
import styles from './Registration.module.css'

/** Opens from the recovery link: /recover/reset?token=...&email=... */
export function ResetPasswordPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const email = params.get('email') ?? ''

  const schema = z
    .object({
      password: z.string().min(8, t('registration.apply.errors.password')),
      password_confirmation: z.string(),
    })
    .refine((v) => v.password === v.password_confirmation, {
      path: ['password_confirmation'],
      message: t('registration.apply.errors.passwordMatch'),
    })
  type Values = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  const reset = useMutation({
    mutationFn: (v: Values) => resetPassword({ email, token, ...v }),
  })

  if (reset.isSuccess) {
    return (
      <RegistrationPage step={4}>
        <div>
          <h1>{t('registration.reset.doneTitle')}</h1>
          <p className={styles.lead}>{t('registration.reset.doneBody')}</p>
        </div>
        <div className={styles.actions}>
          <ButtonLink variant="primary" to="/sign-in">
            {t('common.signIn')}
          </ButtonLink>
        </div>
      </RegistrationPage>
    )
  }

  const invalid = reset.error instanceof ApiError

  return (
    <RegistrationPage step={4}>
      <div>
        <h1>{t('registration.reset.title')}</h1>
      </div>
      {invalid ? (
        <ErrorSummary
          title={t('registration.reset.invalidTitle')}
          items={[t('registration.reset.invalidBody')]}
        />
      ) : null}
      <form
        className={styles.form}
        noValidate
        onSubmit={handleSubmit((v) => reset.mutateAsync(v).catch(() => undefined))}
      >
        <Field
          label={t('registration.reset.newPassword')}
          error={errors.password?.message}
          hint={t('registration.apply.hints.password')}
        >
          <input
            type="password"
            autoComplete="new-password"
            disabled={isSubmitting}
            aria-invalid={errors.password ? true : undefined}
            {...register('password')}
          />
        </Field>
        <Field
          label={t('registration.apply.fields.password_confirmation')}
          error={errors.password_confirmation?.message}
        >
          <input
            type="password"
            autoComplete="new-password"
            disabled={isSubmitting}
            aria-invalid={errors.password_confirmation ? true : undefined}
            {...register('password_confirmation')}
          />
        </Field>
        <div className={styles.actions}>
          <Button type="submit" variant="primary" disabled={isSubmitting || !token || !email}>
            {t('registration.reset.submit')}
          </Button>
          <Link to="/recover" className={styles.linkButton}>
            {t('registration.reset.requestNew')}
          </Link>
        </div>
      </form>
    </RegistrationPage>
  )
}
