import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { listThreadsAbout } from '@/api/discussion'
import { qk } from '@/api/queryKeys'
import type { TargetType } from '@/api/schemas/discussion'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { useProject } from '@/features/projects/useProject'
import styles from './Discussion.module.css'

/**
 * "Discussions about this", on an item's own screen: the threads that are about it, each a link into the discussion
 * screen, and a link that starts a new one about this item. Shows nothing it cannot know: if the list cannot be loaded
 * it says so and still offers to start one.
 */
export function ItemDiscussions({ projectId, type, id }: { projectId: number; type: Extract<TargetType, 'evidence' | 'finding'>; id: number }) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const { can } = useProject()
  const about = useQuery({ queryKey: qk.project(projectId).discussion.about(type, id), queryFn: ({ signal }) => listThreadsAbout(projectId, type, id, signal), retry: false })
  const base = `/projects/${projectId}/discussion`
  const items = about.data?.items ?? []

  return (
    <section className={styles.stack} aria-label={t('discussion.item.title')}>
      <h3>{t('discussion.item.title')}</h3>
      {about.isError ? <p className={styles.meta}>{t('discussion.item.failed')}</p> : null}
      {about.data && items.length === 0 ? <p className={styles.meta}>{t('discussion.item.none')}</p> : null}
      {items.length > 0 ? (
        <ul className={styles.list}>
          {items.map((th) => (
            <li key={th.id}>
              <Link to={`${base}?thread=${th.id}&state=all`}>
                <BidiText>{th.title}</BidiText>
              </Link>{' '}
              <span className={styles.meta}>
                {th.is_resolved ? t('discussion.state.resolved') : t('discussion.state.open')} ·{' '}
                {t('discussion.list.replies', { count: th.comments_count ?? 0, formattedCount: n(th.comments_count ?? 0) })}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {about.data && about.data.total > items.length ? <p className={styles.meta}>{t('discussion.item.more', { count: about.data.total - items.length, formattedCount: n(about.data.total - items.length) })}</p> : null}
      {can('comment') ? <Link to={`${base}?new=1&targetType=${type}&targetId=${id}`}>{t('discussion.item.start')}</Link> : null}
    </section>
  )
}
