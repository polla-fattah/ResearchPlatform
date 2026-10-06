import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Decision } from '@/api/admin'
import type { AdminApplication } from '@/api/schemas/admin'
import { usePreferences } from '@/app/preferencesContext'
import { NeutralState } from '@/components/Badges'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { ConfirmAction } from '@/components/ConfirmAction'
import { Field } from '@/components/Field'
import { accountCode, applicationCode, isOpen, MIN_REASON } from './adminModel'
import styles from './Admin.module.css'

interface Props {
  application: AdminApplication
  busy: boolean
  onDecide: (decision: Decision, text: string) => void
}

/** One application: who applied and what they said, the thread with them, and the three ways to decide it. */
export function ApplicationDetail({ application: a, busy, onDecide }: Props) {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const [text, setText] = useState('')
  const [confirm, setConfirm] = useState<'approved' | 'rejected' | null>(null)

  const profile = a.user.profile
  const interests = a.research_statement || profile?.research_interests?.join(', ') || ''
  const reason = text.trim()
  const reasonOk = reason.length >= MIN_REASON
  const open = isOpen(a.status)

  return (
    <article className={styles.detail} aria-label={a.user.display_name}>
      <p className={styles.code}>
        {applicationCode(a)} · {t(`admin.applications.status.${a.status}`, { defaultValue: a.status })}
        {a.created_at ? ` · ${t('admin.applications.submitted', { when: date(a.created_at) })}` : ''}
      </p>
      <h2>
        <BidiText>{a.user.display_name}</BidiText>
      </h2>

      <dl className={styles.facts}>
        <dt>{t('admin.applications.email')}</dt>
        <dd>{a.user.email}</dd>
        <dt>{t('admin.applications.interests')}</dt>
        <dd>{interests ? <BidiText>{interests}</BidiText> : <NeutralState kind="unknown" />}</dd>
        <dt>{t('admin.applications.language')}</dt>
        <dd>{a.user.preferred_language ? t(`registration.languages.${a.user.preferred_language}`, { defaultValue: a.user.preferred_language }) : <NeutralState kind="unknown" />}</dd>
        <dt>{t('admin.applications.affiliation')}</dt>
        <dd>{profile?.affiliation ? <BidiText>{profile.affiliation}</BidiText> : <NeutralState kind="unknown">{t('admin.applications.notProvided')}</NeutralState>}</dd>
        {profile?.biography ? (
          <>
            <dt>{t('admin.applications.biography')}</dt>
            <dd>
              <BidiText>{profile.biography}</BidiText>
            </dd>
          </>
        ) : null}
        <dt>{t('admin.applications.account')}</dt>
        <dd>
          {accountCode(a.user.id)} · {t(`admin.accounts.status.${a.user.status}`, { defaultValue: a.user.status })}
        </dd>
      </dl>

      {a.information_request || (a.replies?.length ?? 0) > 0 ? (
        <section aria-label={t('admin.applications.thread')}>
          <h3>{t('admin.applications.thread')}</h3>
          <ul className={styles.thread}>
            {a.information_request ? (
              <li>
                <strong>{t('admin.applications.asked')}</strong>
                {a.information_request.requested_at ? ` · ${date(a.information_request.requested_at, { time: true })}` : ''}
                <div>
                  <BidiText>{a.information_request.message}</BidiText>
                </div>
                {a.information_request.deadline ? <div className={styles.hint}>{t('admin.applications.deadline', { when: date(a.information_request.deadline) })}</div> : null}
              </li>
            ) : null}
            {(a.replies ?? []).map((r) => (
              <li key={r.id}>
                <strong>{t('admin.applications.replied')}</strong>
                {r.created_at ? ` · ${date(r.created_at, { time: true })}` : ''}
                <div>
                  <BidiText>{r.message}</BidiText>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!open ? (
        <section aria-label={t('admin.applications.decided')}>
          <h3>{t('admin.applications.decided')}</h3>
          <p>
            {a.decided_at ? t('admin.applications.decidedOn', { by: a.decided_by ? accountCode(a.decided_by) : '—', when: date(a.decided_at, { time: true }) }) : null}
          </p>
          {a.decision_reason ? (
            <p>
              <BidiText>{a.decision_reason}</BidiText>
            </p>
          ) : null}
        </section>
      ) : (
        <div className={styles.decision}>
          <Field label={t('admin.applications.reasonLabel')} hint={t('admin.applications.reasonHint', { min: MIN_REASON })}>
            <textarea rows={3} dir="auto" value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <div className={styles.actions}>
            <Button variant="primary" disabled={busy} onClick={() => setConfirm('approved')}>
              {t('admin.applications.approve')}
            </Button>
            <Button disabled={busy || !reasonOk} onClick={() => onDecide('information_requested', reason)}>
              {t('admin.applications.requestInfo')}
            </Button>
            <Button variant="danger" disabled={busy || !reasonOk} onClick={() => setConfirm('rejected')}>
              {t('admin.applications.decline')}
            </Button>
          </div>
          {!reasonOk ? <p className={styles.hint}>{t('admin.applications.needReason', { min: MIN_REASON })}</p> : null}
          <p className={styles.hint}>{t('admin.applications.recorded')}</p>
        </div>
      )}

      <ConfirmAction
        open={confirm !== null}
        danger={confirm === 'rejected'}
        title={t(confirm === 'rejected' ? 'admin.applications.declineTitle' : 'admin.applications.approveTitle', { name: a.user.display_name })}
        confirmLabel={t(confirm === 'rejected' ? 'admin.applications.declineConfirm' : 'admin.applications.approveConfirm')}
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) onDecide(confirm, reason)
          setConfirm(null)
        }}
      >
        <p>{t(confirm === 'rejected' ? 'admin.applications.declineBody' : 'admin.applications.approveBody')}</p>
      </ConfirmAction>
    </article>
  )
}
