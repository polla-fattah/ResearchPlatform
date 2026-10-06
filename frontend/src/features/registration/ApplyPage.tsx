import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { applyForAccess } from '@/api/applications'
import { ApiError } from '@/api/errors'
import { useAuth } from '@/app/authContext'
import { Button } from '@/components/Button'
import { ErrorSummary, Field } from '@/components/Field'
import { setLanguage } from '@/i18n'
import { isLanguage } from '@/i18n/languages'
import { RegistrationPage } from './RegistrationPage'
import styles from './Registration.module.css'
import { errorMessage } from '@/api/errorMessage'

const FIELDS = [
  'display_name',
  'email',
  'password',
  'password_confirmation',
  'research_interests',
  'preferred_language',
  'affiliation',
  'biography',
] as const
type FieldName = (typeof FIELDS)[number]

const isField = (k: string): k is FieldName => (FIELDS as readonly string[]).includes(k)

export function ApplyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { status, startSession } = useAuth()

  // Messages come from i18n so they follow the interface language.
  const schema = z
    .object({
      display_name: z.string().trim().min(1, t('registration.apply.errors.name')),
      email: z.email(t('registration.apply.errors.email')),
      password: z.string().min(8, t('registration.apply.errors.password')),
      password_confirmation: z.string(),
      research_interests: z.string().trim().min(1, t('registration.apply.errors.interests')),
      preferred_language: z.enum(['ckb', 'ar', 'en'], t('registration.apply.errors.language')),
      affiliation: z.string().optional(),
      biography: z.string().optional(),
    })
    .refine((v) => v.password === v.password_confirmation, {
      path: ['password_confirmation'],
      message: t('registration.apply.errors.passwordMatch'),
    })
  type Values = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  const apply = useMutation({
    mutationFn: applyForAccess,
    onSuccess: async (result, input) => {
      await startSession(result.token)
      if (isLanguage(input.preferred_language)) await setLanguage(input.preferred_language)
      navigate('/apply/check-email', { replace: true, state: { email: result.user.email } })
    },
    onError: (err) => {
      // Server field errors (422) land on the same inputs; everything the user typed stays.
      if (err instanceof ApiError) {
        for (const [key, messages] of Object.entries(err.fields)) {
          if (isField(key) && messages[0]) setError(key, { message: messages[0] })
        }
      }
    },
  })

  // After a successful apply the session starts before we navigate; do not bounce to /status first.
  if (status === 'authenticated' && !apply.isPending && !apply.isSuccess) {
    return <Navigate to="/status" replace />
  }

  const problems = FIELDS.flatMap((f) => {
    const message = errors[f]?.message
    return message ? [`${t(`registration.apply.fields.${f}`)}: ${message}`] : []
  })
  const serverMessage =
    apply.error instanceof ApiError && Object.keys(apply.error.fields).length === 0
      ? errorMessage(apply.error, t)
      : null
  const locked = isSubmitting || apply.isPending

  return (
    <RegistrationPage step={0}>
      <div>
        <h1>{t('registration.apply.title')}</h1>
        <p className={styles.lead}>{t('registration.apply.lead')}</p>
      </div>

      {problems.length > 0 && isSubmitted ? (
        <ErrorSummary
          title={t('registration.apply.fixFields', { count: problems.length })}
          items={problems}
          footer={t('registration.apply.answersSaved')}
        />
      ) : null}
      {serverMessage ? (
        <ErrorSummary
          title={t('registration.apply.failed')}
          items={[serverMessage]}
          footer={t('registration.apply.answersSaved')}
        />
      ) : null}

      <form
        className={styles.form}
        noValidate
        onSubmit={handleSubmit((v) =>
          apply
            .mutateAsync({
              display_name: v.display_name.trim(),
              email: v.email,
              password: v.password,
              password_confirmation: v.password_confirmation,
              research_interests: v.research_interests.trim(),
              preferred_language: v.preferred_language,
              affiliation: v.affiliation?.trim(),
              biography: v.biography?.trim(),
            })
            .catch(() => undefined),
        )}
      >
        <Field
          label={t('registration.apply.fields.display_name')}
          requirement="required"
          error={errors.display_name?.message}
        >
          <input
            disabled={locked}
            autoComplete="name"
            placeholder={t('registration.apply.placeholders.name')}
            aria-invalid={errors.display_name ? true : undefined}
            {...register('display_name')}
          />
        </Field>

        <Field
          label={t('registration.apply.fields.email')}
          requirement="required"
          error={errors.email?.message}
          hint={t('registration.apply.hints.email')}
        >
          <input
            type="email"
            disabled={locked}
            autoComplete="email"
            // audit-ok: an example address, not a sentence
            placeholder="name@example.org"
            aria-invalid={errors.email ? true : undefined}
            {...register('email')}
          />
        </Field>

        <Field
          label={t('registration.apply.fields.password')}
          requirement="required"
          error={errors.password?.message}
          hint={t('registration.apply.hints.password')}
        >
          <input
            type="password"
            disabled={locked}
            autoComplete="new-password"
            aria-invalid={errors.password ? true : undefined}
            {...register('password')}
          />
        </Field>

        <Field
          label={t('registration.apply.fields.password_confirmation')}
          requirement="required"
          error={errors.password_confirmation?.message}
        >
          <input
            type="password"
            disabled={locked}
            autoComplete="new-password"
            aria-invalid={errors.password_confirmation ? true : undefined}
            {...register('password_confirmation')}
          />
        </Field>

        <Field
          label={t('registration.apply.fields.research_interests')}
          requirement="required"
          error={errors.research_interests?.message}
        >
          <textarea
            rows={3}
            disabled={locked}
            placeholder={t('registration.apply.placeholders.interests')}
            aria-invalid={errors.research_interests ? true : undefined}
            {...register('research_interests')}
          />
        </Field>

        <Field
          label={t('registration.apply.fields.preferred_language')}
          requirement="required"
          error={errors.preferred_language?.message}
          hint={t('registration.apply.hints.language')}
        >
          <select
            disabled={locked}
            aria-invalid={errors.preferred_language ? true : undefined}
            {...register('preferred_language')}
          >
            <option value="">{t('registration.apply.chooseLanguage')}</option>
            <option value="ckb">Sorani · کوردی</option>
            <option value="ar">Arabic · العربية</option>
            {/* audit-ok: a language is named in its own language */}
            <option value="en">English</option>
          </select>
        </Field>

        <div className={styles.divider} />

        <Field
          label={t('registration.apply.fields.affiliation')}
          requirement="optional"
          hint={t('registration.apply.hints.affiliation')}
        >
          <input
            disabled={locked}
            placeholder={t('registration.apply.placeholders.affiliation')}
            {...register('affiliation')}
          />
        </Field>

        <Field label={t('registration.apply.fields.biography')} requirement="optional">
          <textarea
            rows={3}
            disabled={locked}
            placeholder={t('registration.apply.placeholders.biography')}
            {...register('biography')}
          />
        </Field>

        <div className={styles.actions}>
          <Button type="submit" variant="primary" disabled={locked}>
            {locked ? t('registration.apply.submitting') : t('registration.apply.submit')}
          </Button>
          <Link to="/status" className={styles.linkButton}>
            {t('registration.apply.checkStatus')}
          </Link>
        </div>
      </form>
    </RegistrationPage>
  )
}
