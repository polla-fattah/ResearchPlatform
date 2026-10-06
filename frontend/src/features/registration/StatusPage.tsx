import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { getMyStatus, respondToApplication } from '@/api/applications'

import type { MyStatus } from '@/api/schemas/application'
import type { Me } from '@/api/schemas/auth'
import { useAuth } from '@/app/authContext'
import { usePreferences } from '@/app/preferencesContext'
import { Button, ButtonLink } from '@/components/Button'
import { ErrorSummary, Field, Notice } from '@/components/Field'
import { BidiText } from '@/components/BidiText'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { CheckEmailCard } from './CheckEmailPage'
import { RegistrationPage, type ReviewOutcome } from './RegistrationPage'
import styles from './Registration.module.css'
import { qk } from '@/api/queryKeys'
import { invalidate } from '@/api/invalidate'
import { errorMessage } from '@/api/errorMessage'

/** First path segment -> nav label key, for "You tried to open Projects". */
const AREA_LABEL: Record<string, string> = {
  home: 'nav.home',
  library: 'nav.library',
  projects: 'nav.projects',
  searches: 'nav.savedSearches',
  downloads: 'nav.downloads',
  settings: 'nav.settings',
}

/**
 * The only page open to accounts that are not approved (ACC-03): unverified, pending,
 * information requested, rejected, suspended. Approved accounts see "You're approved".
 */
export function StatusPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const location = useLocation()
  const query = useQuery({ queryKey: qk.application.status, queryFn: ({ signal }) => getMyStatus(signal) })
  const state = viewStateOf(query)

  const blockedSegment = (location.state as { blocked?: string } | null)?.blocked
    ?.split('/')
    .filter(Boolean)[0]
  const blockedKey = blockedSegment ? AREA_LABEL[blockedSegment] : undefined

  const banner = blockedKey ? (
    <Notice dashed>
      <strong>{t('registration.status.blockedTitle')}</strong>{' '}
      {t('registration.status.blockedBody', { area: t(blockedKey) })}
    </Notice>
  ) : null

  // An unverified account is on step 2 of "How access works": go straight to the email step.
  if (user?.status === 'unverified') {
    return <CheckEmailCard email={user.email} initialWait={0} />
  }

  return (
    <StateBoundary state={state} onRetry={() => void query.refetch()} errorValue={query.error}>
      {query.data ? (
        <StatusBody status={query.data} user={user} banner={banner} />
      ) : null}
    </StateBoundary>
  )
}

function StatusBody({
  status,
  user,
  banner,
}: {
  status: MyStatus
  user: Me | null
  banner: ReactNode
}) {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const app = status.application
  const kind = status.user_status === 'suspended' ? 'suspended' : status.user_status === 'closure_requested' ? 'closure' : (app?.status ?? 'none')

  if (kind === 'closure') {
    return (
      <RegistrationPage step={4}>
        <h1>{t('registration.status.closureTitle')}</h1>
        <p className={styles.lead}>{t('registration.status.closureBody')}</p>
      </RegistrationPage>
    )
  }

  if (kind === 'approved' || status.user_status === 'approved') {
    return (
      <RegistrationPage step={4}>
        <div>
          <h1>{t('registration.status.approvedTitle')}</h1>
          <p className={styles.lead}>
            {app?.decided_at
              ? t('registration.status.approvedBody', { date: date(app.decided_at) })
              : t('registration.status.approvedBodyNoDate')}
          </p>
        </div>
        <div className={styles.actions}>
          <ButtonLink variant="primary" to="/home">
            {t('registration.status.goHome')}
          </ButtonLink>
        </div>
      </RegistrationPage>
    )
  }

  if (kind === 'suspended') {
    return (
      <RegistrationPage step={4}>
        <h1>{t('registration.status.suspendedTitle')}</h1>
        <p className={styles.lead}>{t('registration.status.suspendedBody')}</p>
      </RegistrationPage>
    )
  }

  const outcome: ReviewOutcome =
    kind === 'information_requested' ? 'info' : kind === 'rejected' ? 'rejected' : 'review'

  return (
    <RegistrationPage step={2} review={outcome}>
      {banner}
      <div>
        {app?.reference ? (
          <p className="mono">
            {t('registration.status.application', { reference: app.reference })}
            {app.submitted_at
              ? ` · ${t('registration.status.submitted', { date: date(app.submitted_at, { time: true }) })}`
              : ''}
          </p>
        ) : null}
        <h1>
          {kind === 'information_requested'
            ? t('registration.status.infoTitle')
            : kind === 'rejected'
              ? t('registration.status.rejectedTitle')
              : t('registration.status.pendingTitle')}
        </h1>
        {kind === 'pending' || kind === 'none' ? (
          <p className={styles.lead}>{t('registration.status.pendingBody', { email: user?.email ?? '' })}</p>
        ) : null}
      </div>

      {kind === 'information_requested' && app?.information_request ? (
        <blockquote className={styles.quote}>
          <div className={styles.meta}>
            {t('registration.status.fromAdmin')}
            {app.information_request.requested_at
              ? ` · ${date(app.information_request.requested_at, { time: true })}`
              : ''}
          </div>
          <BidiText as="p">{app.information_request.message}</BidiText>
          {app.information_request.deadline ? (
            <div className={styles.meta}>
              {t('registration.status.deadline', { date: date(app.information_request.deadline) })}
            </div>
          ) : null}
        </blockquote>
      ) : null}

      {kind === 'rejected' ? (
        <>
          <blockquote className={styles.quote}>
            <div className={styles.meta}>
              {t('registration.status.reasonGiven')}
              {app?.decided_at ? ` · ${date(app.decided_at, { time: true })}` : ''}
            </div>
            <BidiText as="p">{app?.decision_reason ?? t('common.unknown')}</BidiText>
          </blockquote>
          <p className={styles.lead}>{t('registration.status.keepAccount')}</p>
        </>
      ) : null}

      {kind === 'information_requested' || kind === 'rejected' ? (
        <ReplyForm
          label={kind === 'rejected' ? t('registration.status.reconsider') : t('registration.status.reply')}
          submitLabel={kind === 'rejected' ? t('registration.status.reconsiderSend') : t('registration.status.replySend')}
        />
      ) : null}

      {(kind === 'pending' || kind === 'none') && user ? <Summary user={user} /> : null}
    </RegistrationPage>
  )
}

function Summary({ user }: { user: Me }) {
  const { t } = useTranslation()
  const profile = user.profile
  const language = user.preferred_language
  return (
    <dl className={styles.facts}>
      <dt>{t('registration.apply.fields.display_name')}</dt>
      <dd>{user.display_name}</dd>
      <dt>{t('registration.apply.fields.research_interests')}</dt>
      <dd>{profile?.research_interests?.join(', ') || t('common.unknown')}</dd>
      <dt>{t('registration.apply.fields.preferred_language')}</dt>
      <dd>{language ? t(`registration.languages.${language}`, { defaultValue: language }) : t('common.unknown')}</dd>
      <dt>{t('registration.apply.fields.affiliation')}</dt>
      <dd>{profile?.affiliation || t('registration.status.notProvided')}</dd>
    </dl>
  )
}

/** Reply to an information request, or ask for reconsideration. Failed sends keep the text. */
function ReplyForm({ label, submitLabel }: { label: string; submitLabel: string }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const send = useMutation({
    mutationFn: () => respondToApplication(text.trim()),
    onSuccess: () => invalidate.applicationStatus(qc),
  })
  const tooShort = text.trim().length < 5

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault()
        if (!tooShort) send.mutate()
      }}
    >
      {send.isError ? (
        <ErrorSummary
          title={t('registration.status.replyFailed')}
          items={[errorMessage(send.error, t)]}
          footer={t('registration.status.replyKept')}
        />
      ) : null}
      <Field label={label}>
        <textarea rows={5} value={text} disabled={send.isPending} onChange={(e) => setText(e.target.value)} />
      </Field>
      <div className={styles.actions}>
        <Button type="submit" variant="primary" disabled={send.isPending || tooShort}>
          {send.isPending ? t('registration.apply.submitting') : submitLabel}
        </Button>
      </div>
    </form>
  )
}
