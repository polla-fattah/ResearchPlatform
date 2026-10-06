import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { getAnnouncement, getAnnouncementHistory } from '@/api/announcements'
import { qk } from '@/api/queryKeys'
import { usePreferences } from '@/app/preferencesContext'
import { Button } from '@/components/Button'
import { NeutralState } from '@/components/Badges'
import { BidiText } from '@/components/BidiText'
import { RefreshNotice } from '@/components/RefreshNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { ROLE_LABEL_KEYS } from '@/domain/roles'
import { useProject } from '@/features/projects/useProject'
import { AnnouncementForm } from './AnnouncementForm'
import { isHidden, isLive } from './announcementModel'
import styles from './Announcement.module.css'

/**
 * Screen 19. The saved announcement and its history are server data; the only local state is "a first draft has been
 * started" (there is nothing saved to show yet). Only the owner can change anything: everyone else reads.
 */
export function AnnouncementPage() {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const { id, project, role, can } = useProject()
  const [starting, setStarting] = useState(false)
  const canEdit = can('publishAnnouncement')
  const projectId = id ?? 0

  const query = useQuery({ queryKey: qk.project(projectId).announcement.detail, queryFn: ({ signal }) => getAnnouncement(projectId, signal), enabled: id !== null })
  const history = useQuery({
    queryKey: qk.project(projectId).announcement.history,
    queryFn: ({ signal }) => getAnnouncementHistory(projectId, signal),
    enabled: id !== null && !!query.data,
    retry: false,
  })

  if (id === null || !project || !role) return null
  const a = query.data
  const view = query.data !== undefined ? 'normal' : viewStateOf(query)
  const hidden = isHidden(a ?? null)

  return (
    <section>
      <StateBoundary state={view} errorValue={query.error} onRetry={() => void query.refetch()}>
        <RefreshNotice query={query} what={t('announcement.title')} />
        {!canEdit ? (
          <p>
            <NeutralState kind="limitation">{t('announcement.readOnly', { role: t(ROLE_LABEL_KEYS[role]) })}</NeutralState>
          </p>
        ) : null}

        {a ? (
          <>
            <div className={styles.status}>
              <h2>{t('announcement.title')}</h2>
              <span className={[styles.pill, isLive(a) ? styles.live : ''].join(' ')}>{t(`announcement.status.${a.status}`, { defaultValue: a.status })}</span>
              {isLive(a) ? (
                <Link to={`/announcements/${encodeURIComponent(a.public_slug)}`}>{t('announcement.openPublic')}</Link>
              ) : null}
              {isLive(a) && a.published_at ? <span className={styles.hint}>{t('announcement.publishedOn', { date: date(a.published_at) })}</span> : null}
            </div>
            {hidden ? (
              <p>
                <NeutralState kind="limitation">{t('announcement.hidden')}</NeutralState>
              </p>
            ) : null}
            <AnnouncementForm key={`${a.id}-${a.updated_at ?? ''}-${a.status}`} projectId={id} project={project} announcement={a} canEdit={canEdit && !hidden} />

            <h3>{t('announcement.history.title')}</h3>
            {history.isPending ? <p className={styles.hint}>{t('states.loading.label')}</p> : null}
            {history.isError ? <p className={styles.hint}>{t('announcement.history.failed')}</p> : null}
            {history.data && history.data.length === 0 ? <p className={styles.hint}>{t('announcement.history.none')}</p> : null}
            {history.data && history.data.length > 0 ? (
              <ul className={styles.history}>
                {history.data.map((h) => (
                  <li key={h.id}>
                    <BidiText>{h.summary ?? h.action}</BidiText>
                    <div className={styles.hint}>
                      {h.actor?.display_name ?? t('activity.unknownActor')}
                      {h.created_at ? ` · ${date(h.created_at, { time: true })}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className={styles.hint}>{t('announcement.history.note')}</p>
          </>
        ) : starting && canEdit ? (
          <AnnouncementForm key="first" projectId={id} project={project} announcement={null} canEdit />
        ) : (
          <div className={styles.empty}>
            <h3>{t('announcement.empty.title')}</h3>
            <p>{t('announcement.empty.body')}</p>
            {canEdit ? (
              <Button variant="primary" onClick={() => setStarting(true)}>
                {t('announcement.empty.start')}
              </Button>
            ) : (
              <p className={styles.hint}>{t('announcement.empty.ownerOnly')}</p>
            )}
          </div>
        )}
      </StateBoundary>
    </section>
  )
}
