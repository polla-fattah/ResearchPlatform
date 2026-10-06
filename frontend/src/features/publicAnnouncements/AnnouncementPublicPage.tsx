import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams } from 'react-router-dom'
import { getPublicAnnouncement } from '@/api/publicAnnouncements'
import { qk } from '@/api/queryKeys'
import { useAuth } from '@/app/authContext'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { isProjectStage } from '@/domain/vocab'
import { creditedNames } from './publicModel'
import styles from './Public.module.css'

/**
 * Screen 20 (page). Open to everyone. It shows what the owner chose to publish and what the server's public answer adds
 * (the project's title and scope, the owner's name). An address that is not published, or never was, looks the same.
 */
export function AnnouncementPublicPage() {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const { status } = useAuth()
  const { slug = '' } = useParams()
  const location = useLocation()
  const query = useQuery({ queryKey: qk.public.announcement(slug), queryFn: ({ signal }) => getPublicAnnouncement(slug, signal), retry: false })
  const a = query.data
  const names = creditedNames(a?.project?.owner)
  const stage = a?.research_stage ?? a?.project?.stage ?? ''

  return (
    <div className={styles.page}>
      <StateBoundary
        state={viewStateOf(query)}
        errorValue={query.error}
        onRetry={() => void query.refetch()}
        forbidden={
          <div className={styles.empty}>
            <h1>{t('publicAnnouncements.gone.title')}</h1>
            <p>{t('publicAnnouncements.gone.body')}</p>
            <Link to="/announcements">{t('publicAnnouncements.gone.browse')}</Link>
          </div>
        }
      >
        {a ? (
          <article>
            <p className={styles.banner}>
              <strong>{t('publicAnnouncements.page.label')}</strong> {t('publicAnnouncements.page.notice')}
            </p>
            <h1>
              <BidiText>{a.title}</BidiText>
            </h1>
            <p className={styles.summary}>
              <BidiText>{a.summary}</BidiText>
            </p>
            <dl className={styles.facts}>
              {a.project?.title ? (
                <>
                  <dt>{t('publicAnnouncements.page.project')}</dt>
                  <dd>
                    <BidiText>{a.project.title}</BidiText>
                  </dd>
                </>
              ) : null}
              {a.project?.scope ? (
                <>
                  <dt>{t('publicAnnouncements.page.scope')}</dt>
                  <dd>
                    <BidiText>{a.project.scope}</BidiText>
                  </dd>
                </>
              ) : null}
              {stage ? (
                <>
                  <dt>{t('publicAnnouncements.page.stage')}</dt>
                  <dd>{isProjectStage(stage) ? t(`stage.${stage}`) : stage}</dd>
                </>
              ) : null}
              {a.keywords && a.keywords.length > 0 ? (
                <>
                  <dt>{t('publicAnnouncements.page.keywords')}</dt>
                  <dd>
                    <BidiText>{a.keywords.join(' · ')}</BidiText>
                  </dd>
                </>
              ) : null}
              {names.length > 0 ? (
                <>
                  <dt>{t('publicAnnouncements.page.researchers')}</dt>
                  <dd>
                    <BidiText>{names.join(' · ')}</BidiText>
                    {a.project?.owner?.affiliation ? (
                      <div className={styles.meta}>
                        <BidiText>{a.project.owner.affiliation}</BidiText>
                      </div>
                    ) : null}
                  </dd>
                </>
              ) : null}
            </dl>
            {a.published_at ? <p className={styles.meta}>{t('publicAnnouncements.page.published', { date: date(a.published_at) })}</p> : null}

            <section className={styles.aside} aria-label={t('publicAnnouncements.collab.title')}>
              <h2>{t('publicAnnouncements.collab.title')}</h2>
              <p>{t('publicAnnouncements.collab.body')}</p>
              {status === 'authenticated' ? (
                <Link to={`/announcements/${encodeURIComponent(a.public_slug)}/interest`}>{t('publicAnnouncements.collab.ask')}</Link>
              ) : (
                <Link to="/sign-in" state={{ from: location.pathname }}>
                  {t('publicAnnouncements.collab.signIn')}
                </Link>
              )}
            </section>

            <p className={styles.foot}>{t('publicAnnouncements.page.foot')}</p>
            <p>
              <Link to="/announcements">{t('publicAnnouncements.gone.browse')}</Link>
            </p>
          </article>
        ) : null}
      </StateBoundary>
    </div>
  )
}
