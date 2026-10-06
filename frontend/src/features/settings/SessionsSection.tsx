import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listSessions, revokeOtherSessions, revokeSession } from '@/api/account'
import { invalidate } from '@/api/invalidate'
import { qk } from '@/api/queryKeys'
import { usePreferences } from '@/app/preferencesContext'
import { Button } from '@/components/Button'
import { ConfirmAction } from '@/components/ConfirmAction'
import { MutationNotice } from '@/components/MutationNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import styles from './Settings.module.css'

/** Where the account is signed in. The server names every device the same, so the dates are what tell them apart. */
export function SessionsSection() {
  const { t } = useTranslation()
  const { n, date, relative } = usePreferences()
  const qc = useQueryClient()
  const [confirmAll, setConfirmAll] = useState(false)

  const sessions = useQuery({ queryKey: qk.account.sessions, queryFn: ({ signal }) => listSessions(signal) })
  const end = useMutation({ mutationFn: (id: number) => revokeSession(id), onSuccess: () => invalidate.accountSessionsChanged(qc) })
  const endAll = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: async () => {
      setConfirmAll(false)
      await invalidate.accountSessionsChanged(qc)
    },
    onError: () => setConfirmAll(false),
  })

  const items = sessions.data ?? []
  const others = items.filter((s) => !s.current).length

  return (
    <section className={styles.section} aria-label={t('settings.sessions.title', { count: n(items.length) })}>
      <h2>{t('settings.sessions.title', { count: n(items.length) })}</h2>
      <MutationNotice error={end.error ?? endAll.error} title={t('settings.sessions.failed')} />
      <StateBoundary state={viewStateOf(sessions)} errorValue={sessions.error} onRetry={() => void sessions.refetch()}>
        <ul className={styles.rows}>
          {items.map((s) => (
            <li key={s.id} className={styles.row}>
              <span>
                <strong>{s.name || t('settings.sessions.unnamed')}</strong>
                {s.current ? <span className={styles.tag}>{t('settings.sessions.current')}</span> : null}
                <span className={styles.hint}>
                  {s.created_at ? t('settings.sessions.signedIn', { when: date(s.created_at, { time: true }) }) : ''}
                  {s.last_used_at ? ` · ${t('settings.sessions.lastUsed', { when: relative(s.last_used_at) })}` : ''}
                </span>
              </span>
              {!s.current ? (
                <Button variant="ghost" disabled={end.isPending} onClick={() => end.mutate(s.id)} aria-label={`${t('settings.sessions.signOut')} ${date(s.created_at ?? '')}`}>
                  {t('settings.sessions.signOut')}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        {others > 0 ? <Button onClick={() => setConfirmAll(true)}>{t('settings.sessions.signOutOthers')}</Button> : null}
      </StateBoundary>
      <p className={styles.hint}>{t('settings.sessions.note')}</p>

      <ConfirmAction
        open={confirmAll}
        title={t('settings.sessions.othersTitle')}
        confirmLabel={t('settings.sessions.othersConfirm')}
        busy={endAll.isPending}
        onCancel={() => setConfirmAll(false)}
        onConfirm={() => endAll.mutate()}
      >
        <p>{t('settings.sessions.othersBody', { count: others, formattedCount: n(others) })}</p>
      </ConfirmAction>
    </section>
  )
}
