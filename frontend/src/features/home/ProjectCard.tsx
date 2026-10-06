import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { ProjectListItem } from '@/api/schemas/project'
import { hasQuestion } from '@/api/schemas/project'
import { usePreferences } from '@/app/preferencesContext'
import { NeutralState, VisibilityBadge } from '@/components/Badges'
import { BidiText } from '@/components/BidiText'
import { CountedUnit } from '@/components/CountedUnit'
import { formatCode } from '@/domain/codes'
import { isProjectStage } from '@/domain/vocab'
import { normalizeRole } from '@/domain/roles'
import styles from './Home.module.css'

/** One project row, as drawn on Home (and reused by the project index). */
export function ProjectCard({ project }: { project: ProjectListItem }) {
  const { t } = useTranslation()
  const { relative } = usePreferences()
  const role = normalizeRole(project.my_role)
  const stageLabel = isProjectStage(project.stage) ? t(`stage.${project.stage}`) : project.stage

  return (
    <li className={styles.card}>
      <div className={styles.cardTop}>
        <h3 className={styles.cardTitle}>
          <Link to={`/projects/${project.id}/overview`}>
            <BidiText>{project.title}</BidiText>
          </Link>
        </h3>
        <span className={styles.stage}>{stageLabel}</span>
        {/* Projects are private until members join; a project you were invited to is shared. */}
        <VisibilityBadge visibility={role === 'owner' ? 'private' : 'project'} />
      </div>

      {hasQuestion(project) ? (
        <BidiText as="p" className={styles.question}>
          {project.question ?? ''}
        </BidiText>
      ) : (
        <p>
          <NeutralState kind="unknown">{t('home.questionNotWritten')}</NeutralState>
        </p>
      )}

      <div className={styles.cardMeta}>
        <span>
          <CountedUnit count={project.evidence_count ?? 0} unit="evidence" />
          {' · '}
          <CountedUnit count={project.finding_count ?? 0} unit="finding" />
        </span>
        {project.last_activity_at ? (
          <span>{t('home.updated', { when: relative(project.last_activity_at) })}</span>
        ) : null}
        <span className={styles.code}>{formatCode('PRJ', project.id)}</span>
      </div>
    </li>
  )
}
