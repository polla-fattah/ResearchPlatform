import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listSubscriptions, subscribe, toggleSubscription } from '@/api/searchCompare'
import { invalidate } from '@/api/invalidate'
import { qk } from '@/api/queryKeys'
import { FREQUENCIES, type Frequency } from '@/api/schemas/searchCompare'
import { usePreferences } from '@/app/preferencesContext'
import { useAuth } from '@/app/authContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { MutationNotice } from '@/components/MutationNotice'
import { RefreshNotice } from '@/components/RefreshNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { splitSubscriptions } from './compareModel'
import styles from './SearchCompare.module.css'

/**
 * Whether the signed-in person wants to be told about a saved query, and how often. The server keeps this choice but
 * nothing on it reruns a query or sends an alert yet (request file C-40), so the panel says that plainly and does not
 * promise results. Each person's subscription is their own: nobody else's can be changed from here.
 */
export function SchedulePanel({ projectId, queryId, canEdit }: { projectId: number; queryId: number; canEdit: boolean }) {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [frequency, setFrequency] = useState<Frequency>('weekly')
  const list = useQuery({ queryKey: qk.project(projectId).search.subscriptions, queryFn: ({ signal }) => listSubscriptions(projectId, signal) })
  const { mine, others } = splitSubscriptions(list.data ?? [], queryId, user?.id)
  const done = () => invalidate.searchChanged(qc, projectId)
  const save = useMutation({ mutationFn: (f: Frequency) => subscribe(projectId, queryId, f), onSuccess: done })
  const toggle = useMutation({ mutationFn: () => toggleSubscription(projectId, mine!.id, !mine!.is_active), onSuccess: done })
  const view = list.data ? 'normal' : viewStateOf(list)

  return (
    <section className={styles.section} aria-labelledby="schedule-h">
      <h2 id="schedule-h">{t('searchCompare.schedule.title')}</h2>
      <p className={styles.note} role="note">
        {t('searchCompare.schedule.notRunning')}
      </p>
      <StateBoundary state={view} errorValue={list.error} onRetry={() => void list.refetch()}>
        <RefreshNotice query={list} what={t('searchCompare.schedule.title')} />
        {mine ? (
          <div>
            <p>
              {mine.is_active ? t('searchCompare.schedule.on', { frequency: t(`searchCompare.frequency.${mine.frequency}`, { defaultValue: mine.frequency }) }) : t('searchCompare.schedule.off')}
            </p>
            <p className={styles.meta}>
              {mine.last_run_at ? t('searchCompare.schedule.lastRun', { date: date(mine.last_run_at), count: mine.last_result_count ?? 0 }) : t('searchCompare.schedule.neverRun')}
            </p>
          </div>
        ) : (
          <p className={styles.meta}>{t('searchCompare.schedule.none')}</p>
        )}
        {canEdit ? (
          <div className={styles.pickers}>
            <Field label={t('searchCompare.schedule.frequency')} requirement="optional">
              <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {t(`searchCompare.frequency.${f}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Button variant="primary" onClick={() => save.mutate(frequency)} disabled={save.isPending}>
              {mine ? t('searchCompare.schedule.change') : t('searchCompare.schedule.subscribe')}
            </Button>
            {mine ? (
              <Button onClick={() => toggle.mutate()} disabled={toggle.isPending}>
                {mine.is_active ? t('searchCompare.schedule.turnOff') : t('searchCompare.schedule.turnOn')}
              </Button>
            ) : null}
          </div>
        ) : (
          <p className={styles.meta}>{t('searchCompare.schedule.readOnly')}</p>
        )}
        <MutationNotice error={save.error ?? toggle.error} title={t('searchCompare.schedule.failed')} />
        <h3>{t('searchCompare.schedule.others')}</h3>
        {others.length === 0 ? (
          <p className={styles.meta}>{t('searchCompare.schedule.othersNone')}</p>
        ) : (
          <ul className={styles.alts} aria-label={t('searchCompare.schedule.others')}>
            {others.map((s) => (
              <li key={s.id}>
                {s.user?.display_name ? <BidiText>{s.user.display_name}</BidiText> : t('searchCompare.schedule.someone')} · {t(`searchCompare.frequency.${s.frequency}`, { defaultValue: s.frequency })}
              </li>
            ))}
          </ul>
        )}
      </StateBoundary>
    </section>
  )
}
