import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams } from 'react-router-dom'
import { z } from 'zod'
import { sendInterest } from '@/api/collaboration'
import { ApiError } from '@/api/errors'
import { getPublicAnnouncement } from '@/api/publicAnnouncements'
import { qk } from '@/api/queryKeys'
import type { Me } from '@/api/schemas/auth'
import { useAuth } from '@/app/authContext'
import { BidiText } from '@/components/BidiText'
import { Button, ButtonLink } from '@/components/Button'
import { Field } from '@/components/Field'
import { MutationNotice } from '@/components/MutationNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { creditedNames, excerpt } from './publicModel'
import styles from './Public.module.css'

const MIN_MESSAGE = 10

/**
 * Screen 40. Offering to collaborate needs an account, so a visitor is asked to sign in first and comes back here. The
 * form shows what the owner will receive (name, affiliation, e-mail address and the message) and asks for consent to
 * share exactly that. If the call has closed while the person was writing, the message stays in the form.
 */
export function InterestPage() {
  const { t } = useTranslation()
  const { slug = '' } = useParams()
  const { status, user } = useAuth()
  const location = useLocation()
  const announcement = useQuery({ queryKey: qk.public.announcement(slug), queryFn: ({ signal }) => getPublicAnnouncement(slug, signal), retry: false })
  const a = announcement.data
  const owner = creditedNames(a?.project?.owner)[0] ?? t('publicAnnouncements.interest.theResearchers')

  return (
    <div className={styles.page}>
      <StateBoundary
        state={viewStateOf(announcement)}
        errorValue={announcement.error}
        onRetry={() => void announcement.refetch()}
        forbidden={
          <div className={styles.empty}>
            <h1>{t('publicAnnouncements.gone.title')}</h1>
            <p>{t('publicAnnouncements.gone.body')}</p>
            <Link to="/announcements">{t('publicAnnouncements.gone.browse')}</Link>
          </div>
        }
      >
        {a ? (
          <>
            <p className={styles.tag}>{t('publicAnnouncements.tag')}</p>
            <h1>
              <BidiText>{a.title}</BidiText>
            </h1>
            <p>
              <BidiText>{excerpt(a.summary, 320).text}</BidiText>
            </p>
            <p>
              <Link to={`/announcements/${encodeURIComponent(a.public_slug)}`}>{t('publicAnnouncements.interest.readFull')}</Link>
            </p>

            {status === 'loading' ? <p>{t('states.loading.label')}</p> : null}

            {status === 'anonymous' ? (
              <section className={styles.aside} aria-label={t('publicAnnouncements.interest.signInTitle')}>
                <h2>{t('publicAnnouncements.interest.signInTitle')}</h2>
                <p>{t('publicAnnouncements.interest.signInBody')}</p>
                <p>
                  <ButtonLink to="/sign-in" state={{ from: location.pathname }} variant="primary">
                    {t('common.signIn')}
                  </ButtonLink>{' '}
                  <ButtonLink to="/apply">{t('publicAnnouncements.interest.createAccount')}</ButtonLink>
                </p>
              </section>
            ) : null}

            {status === 'authenticated' && user ? <InterestForm slug={slug} user={user} owner={owner} /> : null}
          </>
        ) : null}
      </StateBoundary>
    </div>
  )
}

/**
 * The form, mounted only once the signed-in person is known, so its starting values (the affiliation on their profile)
 * are theirs and not empty. A request that went through replaces the form with what was shared.
 */
function InterestForm({ slug, user, owner }: { slug: string; user: Me; owner: string }) {
  const { t } = useTranslation()
  const schema = z.object({
    affiliation: z.string().max(255),
    message: z.string().trim().min(MIN_MESSAGE, t('publicAnnouncements.interest.messageShort', { min: MIN_MESSAGE })),
    consent: z.boolean().refine((v) => v, t('publicAnnouncements.interest.consentRequired')),
  })
  type Values = z.infer<typeof schema>
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { affiliation: user?.profile?.affiliation ?? '', message: '', consent: false } })

  const send = useMutation({
    mutationFn: (v: Values) => sendInterest(slug, { name: user?.display_name ?? '', email: user?.email ?? '', affiliation: v.affiliation.trim(), message: v.message.trim() }),
  })
  const closed = send.error instanceof ApiError && send.error.isNotAvailable


  if (send.isSuccess) {
    return (
      <section className={styles.aside} role="status" aria-label={t('publicAnnouncements.interest.sentTitle', { name: owner })}>
        <h2>{t('publicAnnouncements.interest.sentTitle', { name: owner })}</h2>
        <p>{t('publicAnnouncements.interest.sentBody')}</p>
      </section>
    )
  }

  return (
    <form noValidate onSubmit={handleSubmit((v) => send.mutate(v))} aria-label={t('publicAnnouncements.interest.title')} className={styles.aside}>
      <h2>{t('publicAnnouncements.interest.title')}</h2>
      {closed ? (
        <div role="alert">
          <strong>{t('publicAnnouncements.interest.closedTitle')}</strong>
          <p>{t('publicAnnouncements.interest.closedBody')}</p>
        </div>
      ) : null}
      <dl className={styles.facts}>
        <dt>{t('publicAnnouncements.interest.seen.name')}</dt>
        <dd>
          <BidiText>{user.display_name}</BidiText>
        </dd>
        <dt>{t('publicAnnouncements.interest.seen.email')}</dt>
        <dd dir="ltr">{user.email}</dd>
      </dl>
      <Field label={t('publicAnnouncements.interest.affiliation')} requirement="optional">
        <input dir="auto" {...register('affiliation')} />
      </Field>
      <Field label={t('publicAnnouncements.interest.message')} requirement="required" error={errors.message?.message} hint={t('publicAnnouncements.interest.messageHint')}>
        <textarea rows={6} dir="auto" aria-invalid={errors.message ? true : undefined} {...register('message')} />
      </Field>
      <label>
        <input type="checkbox" {...register('consent')} /> {t('publicAnnouncements.interest.consent', { name: owner })}
      </label>
      {errors.consent ? <p role="alert">{errors.consent.message}</p> : null}
      <p className={styles.meta}>{t('publicAnnouncements.interest.noAccess')}</p>
      {!closed ? <MutationNotice error={send.error} title={t('publicAnnouncements.interest.failed')} /> : null}
      <p>
        <Button type="submit" variant="primary" disabled={send.isPending}>
          {send.isPending ? t('publicAnnouncements.interest.sending') : t('publicAnnouncements.interest.send')}
        </Button>
      </p>
    </form>
  )
}
