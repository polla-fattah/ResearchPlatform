import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { ProjectListItem, ProjectScope } from '@/api/schemas/project'
import { hasQuestion } from '@/api/schemas/project'
import { usePreferences } from '@/app/preferencesContext'
import { NeutralState, VisibilityBadge } from '@/components/Badges'
import { BidiText } from '@/components/BidiText'
import { Button, ButtonLink } from '@/components/Button'
import { CountedUnit } from '@/components/CountedUnit'
import { formatCode } from '@/domain/codes'
import { normalizeRole, ROLE_LABEL_KEYS } from '@/domain/roles'
import { isProjectStage } from '@/domain/vocab'
import styles from './Projects.module.css'
import { useNow } from '@/hooks/useNow'

export type RowAction = 'archive' | 'unarchive' | 'trash' | 'restore' | 'leave'

interface Props {
  project: ProjectListItem
  scope: ProjectScope
  busy: boolean
  onAction: (action: RowAction, project: ProjectListItem) => void
}

/** Whole days until `iso`, never below zero. */
function daysUntil(iso: string, now: number): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 86_400_000))
}

/** One row of the project index. The buttons depend on which tab the row is in. */
export function ProjectRow({ project, scope, busy, onAction }: Props) {
  const { t } = useTranslation()
  const { relative, date, n } = usePreferences()
  const now = useNow()
  const role = normalizeRole(project.my_role)
  const isOwner = role === 'owner'
  const stage = isProjectStage(project.stage) ? t(`stage.${project.stage}`) : project.stage
  const code = formatCode('PRJ', project.id)
  const overview = `/projects/${project.id}/overview`

  let extra: string | null = null
  if (scope === 'shared') {
    extra = t('projects.index.row.owner', {
      owner: project.owner?.display_name ?? t('common.unknown'),
      role: role ? t(ROLE_LABEL_KEYS[role]) : t('common.unknown'),
    })
  } else if (isOwner) {
    extra = t('projects.index.row.ownerYou')
  }

  return (
    <li className={styles.row}>
      <div className={styles.rowTop}>
        <span className={styles.stage}>{stage}</span>
        <VisibilityBadge visibility={isOwner ? 'private' : 'project'} />
        <span className={styles.code}>{code}</span>
        {extra ? <span className={styles.meta}>{extra}</span> : null}
      </div>

      <h2 className={styles.rowTitle}>
        {scope === 'trash' ? (
          // A trashed project can't be opened: the API answers 404 for it (request file C-12).
          <BidiText>{project.title}</BidiText>
        ) : (
          <Link to={overview}>
            <BidiText>{project.title}</BidiText>
          </Link>
        )}
      </h2>

      {hasQuestion(project) ? (
        <BidiText as="p" className={styles.question}>
          {project.question ?? ''}
        </BidiText>
      ) : (
        <p>
          <NeutralState kind="unknown">{t('projects.index.row.noQuestion')}</NeutralState>
        </p>
      )}

      <div className={styles.meta}>
        <span>
          {t('projects.index.row.resources', { count: project.resource_count ?? 0, n: n(project.resource_count ?? 0) })}
          {' · '}
          <CountedUnit count={project.evidence_count ?? 0} unit="evidence" />
          {' · '}
          <CountedUnit count={project.finding_count ?? 0} unit="finding" />
        </span>
        {project.last_activity_at ? (
          <span>{t('projects.index.row.lastActivity', { when: relative(project.last_activity_at) })}</span>
        ) : null}
        {(project.tags ?? []).map((tag) => (
          <span key={tag} className={styles.tag}>
            #{tag}
          </span>
        ))}
      </div>

      {scope === 'owned' || scope === 'shared' ? (
        <div className={styles.next}>
          <span className={styles.nextLabel}>{t('projects.index.row.nextAction')}</span>
          {project.next_action ? (
            <Link to={project.next_action.target}>{project.next_action.label}</Link>
          ) : (
            <span className={styles.meta}>{t('projects.index.row.none')}</span>
          )}
        </div>
      ) : null}
      {scope === 'archived' ? (
        <div className={styles.meta}>{t('projects.index.row.archivedNote', { stage })}</div>
      ) : null}
      {scope === 'trash' && project.recovery_deadline ? (
        <div className={styles.next}>
          <span className={styles.nextLabel}>
            {t('projects.index.row.deleteOn', { date: date(project.recovery_deadline) })}
          </span>
          <span className={styles.meta}>
            {t('projects.index.row.daysLeft', { count: daysUntil(project.recovery_deadline, now) })}
          </span>
        </div>
      ) : null}

      <div className={styles.actions}>
        {scope === 'owned' || scope === 'shared' ? (
          <ButtonLink variant="primary" to={overview}>
            {t('projects.index.row.open')}
          </ButtonLink>
        ) : null}
        {scope === 'archived' ? (
          <ButtonLink to={overview}>{t('projects.index.row.viewReadOnly')}</ButtonLink>
        ) : null}

        {scope === 'owned' && isOwner ? (
          <>
            <Button disabled={busy} onClick={() => onAction('archive', project)}>
              {t('projects.index.row.archive')}
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => onAction('trash', project)}>
              {t('projects.index.row.trash')}
            </Button>
          </>
        ) : null}
        {scope === 'archived' && isOwner ? (
          <Button disabled={busy} onClick={() => onAction('unarchive', project)}>
            {t('projects.index.row.unarchive')}
          </Button>
        ) : null}
        {scope === 'trash' ? (
          <Button disabled={busy} onClick={() => onAction('restore', project)}>
            {t('projects.index.row.restore')}
          </Button>
        ) : null}
        {scope === 'shared' && !isOwner ? (
          <Button disabled={busy} onClick={() => onAction('leave', project)}>
            {t('projects.index.row.leave')}
          </Button>
        ) : null}
      </div>
    </li>
  )
}
