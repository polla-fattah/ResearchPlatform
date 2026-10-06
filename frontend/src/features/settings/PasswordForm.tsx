import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { changePassword } from '@/api/account'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { MutationNotice } from '@/components/MutationNotice'
import { MIN_PASSWORD } from './settingsModel'
import styles from './Settings.module.css'

/** Change the password. The other sessions stay signed in: ending them is a separate choice, just below. */
export function PasswordForm() {
  const { t } = useTranslation()

  const schema = z
    .object({
      current_password: z.string().min(1, t('settings.security.currentRequired')),
      password: z.string().min(MIN_PASSWORD, t('settings.security.passwordShort', { min: MIN_PASSWORD })),
      password_confirmation: z.string(),
    })
    .refine((v) => v.password === v.password_confirmation, { path: ['password_confirmation'], message: t('settings.security.mismatch') })
  type Values = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { current_password: '', password: '', password_confirmation: '' } })

  const change = useMutation({
    mutationFn: (v: Values) => changePassword(v),
    onSuccess: () => reset(),
  })

  return (
    <section className={styles.section} aria-label={t('settings.security.password')}>
      <h2>{t('settings.security.password')}</h2>
      <form className={styles.form} noValidate onSubmit={handleSubmit((v) => change.mutate(v))}>
        <Field label={t('settings.security.current')} error={errors.current_password?.message}>
          <input type="password" autoComplete="current-password" aria-invalid={errors.current_password ? true : undefined} {...register('current_password')} />
        </Field>
        <Field label={t('settings.security.new')} hint={t('settings.security.newHint', { min: MIN_PASSWORD })} error={errors.password?.message}>
          <input type="password" autoComplete="new-password" aria-invalid={errors.password ? true : undefined} {...register('password')} />
        </Field>
        <Field label={t('settings.security.confirm')} error={errors.password_confirmation?.message}>
          <input type="password" autoComplete="new-password" aria-invalid={errors.password_confirmation ? true : undefined} {...register('password_confirmation')} />
        </Field>
        <MutationNotice error={change.error} title={t('settings.security.passwordFailed')} />
        {change.isSuccess ? (
          <p className={styles.success} role="status">
            {t('settings.security.passwordChanged')}
          </p>
        ) : null}
        <div className={styles.saveBar}>
          <Button type="submit" variant="primary" disabled={change.isPending}>
            {change.isPending ? t('settings.saving') : t('settings.security.change')}
          </Button>
        </div>
      </form>
      <p className={styles.hint}>{t('settings.security.otherSessionsStay')}</p>
    </section>
  )
}
