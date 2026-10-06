import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getNotificationPreferences, saveNotificationPreferences } from '@/api/account'
import { invalidate } from '@/api/invalidate'
import { qk } from '@/api/queryKeys'
import { DIGESTS, NOTIFICATION_FLAGS, type NotificationFlag, type NotificationPreferences } from '@/api/schemas/account'
import { isReleaseEnabled } from '@/app/features'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { MutationNotice } from '@/components/MutationNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import styles from './Settings.module.css'

/** Flags whose notices come from features of a later release: they can be set now and start to matter then. */
const LATER: readonly NotificationFlag[] = ['notify_invitations', 'notify_mentions', 'notify_assignments', 'notify_reviews']

type Changes = Partial<NotificationPreferences>

export function NotificationsTab() {
  const { t } = useTranslation()
  const prefs = useQuery({ queryKey: qk.account.notifications, queryFn: ({ signal }) => getNotificationPreferences(signal) })
  const state = viewStateOf(prefs)
  return (
    <StateBoundary state={state} errorValue={prefs.error} onRetry={() => void prefs.refetch()}>
      {prefs.data ? <NotificationForm saved={prefs.data} /> : null}
      <p className={styles.hint}>{t('settings.notifications.note')}</p>
    </StateBoundary>
  )
}

/** The saved settings, with the changes made on top of them; only the changes are sent. */
function NotificationForm({ saved }: { saved: NotificationPreferences }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [changes, setChanges] = useState<Changes>({})

  const value = (flag: NotificationFlag) => changes[flag] ?? saved[flag] ?? true
  const digest = changes.email_digest ?? saved.email_digest ?? 'instant'
  const dirty = Object.keys(changes).length > 0

  const save = useMutation({
    mutationFn: () => saveNotificationPreferences(changes),
    onSuccess: async () => {
      await invalidate.notificationPreferencesChanged(qc)
      setChanges({})
    },
  })

  return (
    <form
      className={styles.form}
      aria-label={t('settings.tabs.notifications')}
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate()
      }}
    >
      <fieldset className={styles.group}>
        <legend>{t('settings.notifications.about')}</legend>
        {NOTIFICATION_FLAGS.map((flag) => (
          <label key={flag} className={styles.check}>
            <input type="checkbox" checked={value(flag)} onChange={(e) => setChanges((c) => ({ ...c, [flag]: e.target.checked }))} />
            <span>
              {t(`settings.notifications.flags.${flag}`)}
              {LATER.includes(flag) && !isReleaseEnabled('R1b') ? <span className={styles.tag}>R1b</span> : null}
            </span>
          </label>
        ))}
      </fieldset>
      <Field label={t('settings.notifications.digest')} hint={t('settings.notifications.digestHint')}>
        <select value={digest} onChange={(e) => setChanges((c) => ({ ...c, email_digest: e.target.value }))}>
          {DIGESTS.map((d) => (
            <option key={d} value={d}>
              {t(`settings.notifications.digests.${d}`)}
            </option>
          ))}
        </select>
      </Field>
      <MutationNotice error={save.error} title={t('settings.saveFailed')} />
      <div className={styles.saveBar}>
        <Button type="submit" variant="primary" disabled={save.isPending || !dirty}>
          {save.isPending ? t('settings.saving') : t('settings.save')}
        </Button>
        <span role="status" className={styles.hint}>
          {save.isPending ? '' : dirty ? t('settings.unsaved') : save.isSuccess ? t('settings.saved') : ''}
        </span>
      </div>
    </form>
  )
}
