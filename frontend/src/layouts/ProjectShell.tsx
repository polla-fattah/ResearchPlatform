import { Link, useLocation } from 'react-router-dom'
import { SuspenseOutlet } from '@/components/SuspenseOutlet'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { BidiText } from '@/components/BidiText'
import { VisibilityBadge } from '@/components/Badges'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { formatCode } from '@/domain/codes'
import { isProjectStage } from '@/domain/vocab'
import { useProject } from '@/features/projects/useProject'
import styles from '@/features/projects/Projects.module.css'
import shell from './Shell.module.css'
import { NavItem } from './NavItem'

/**
 * Project header plus the project tabs from the navigation map. Rendered inside AccountShell.
 * A project that doesn't exist and one you can't open look the same ("Project not available"),
 * so private projects stay private.
 */
export function ProjectShell() {
  const { t } = useTranslation()
  const { id, query, project, role } = useProject()
  const { pathname } = useLocation()
  const state = id === null ? 'forbidden' : viewStateOf(query)
  const base = `/projects/${id}`

  if (state === 'forbidden') {
    return (
      <div className={styles.empty}>
        <h1>{t('projects.notAvailable.title')}</h1>
        <p>{t('projects.notAvailable.body')}</p>
        <Link to="/projects">{t('projects.notAvailable.go')}</Link>
      </div>
    )
  }

  const stageLabel =
    project && isProjectStage(project.stage) ? t(`stage.${project.stage}`) : project?.stage

  return (
    <>
      <header className={shell.projectHeader}>
        <p className={styles.crumbs}>
          <Link to="/projects">{t('projects.breadcrumb.projects')}</Link> /{' '}
          <span className="mono">{id !== null ? formatCode('PRJ', id) : ''}</span>
        </p>
        {project ? (
          <div className={styles.rowTop}>
            <h1 style={{ margin: 0, fontSize: '1.75rem' }}>
              <BidiText>{project.title}</BidiText>
            </h1>
            <span className={styles.stage}>{stageLabel}</span>
            <VisibilityBadge visibility={role === 'owner' ? 'private' : 'project'} />
          </div>
        ) : null}
        <nav className={shell.tabs} aria-label={t('nav.projects')}>
          <NavItem tabStyle to={`${base}/overview`} label="Overview" />
          <NavItem tabStyle to={`${base}/resources`} label="Resources" />
          <NavItem tabStyle to={`${base}/searches`} label="Searches" />
          <NavItem tabStyle to={`${base}/evidence`} label="Evidence" />
          <NavItem tabStyle to={`${base}/analysis`} label="Analysis" />
          <NavItem tabStyle to={`${base}/members`} label={t('members.tab')} />
          <NavItem tabStyle to={`${base}/discussion`} label={t('discussion.tab')} />
          <NavItem tabStyle to={`${base}/findings`} label="Findings & Documents" />
          <NavItem tabStyle to={`${base}/submission`} label={t('submission.tab')} />
          <NavItem tabStyle to={`${base}/activity`} label={t('activity.tab')} />
          <NavItem tabStyle to={`${base}/announcement`} label={t('announcement.tab')} />
          <NavItem tabStyle to={`${base}/settings`} label="Settings" />
        </nav>
        {pathname.startsWith(`${base}/analysis`) || pathname.startsWith(`${base}/argument-map`) ? (
          <nav className={shell.tools} aria-label={t('analysisTools.label')}>
            <NavItem to={`${base}/analysis`} label={t('analysisTools.compare')} end />
            <NavItem to={`${base}/analysis/matn`} label={t('analysisTools.matn')} />
            <NavItem to={`${base}/analysis/isnad`} label={t('analysisTools.isnad')} />
            <NavItem to={`${base}/analysis/families`} label={t('analysisTools.families')} />
            <NavItem to={`${base}/analysis/ilal`} label={t('analysisTools.ilal')} />
            <NavItem to={`${base}/analysis/narrators`} label={t('analysisTools.narrators')} />
            <NavItem to={`${base}/analysis/books`} label={t('analysisTools.books')} />
            <NavItem to={`${base}/argument-map`} label={t('analysisTools.argument')} />
          </nav>
        ) : null}
      </header>
      <StateBoundary
        state={state}
        errorValue={query.error}
        onRetry={() => void query.refetch()}
        error={
          <div className={styles.banner} role="alert">
            <h2>{t('states.error.title')}</h2>
            <p>{t('states.error.body')}</p>
            <Button onClick={() => void query.refetch()}>{t('common.retry')}</Button>
          </div>
        }
      >
        <SuspenseOutlet />
      </StateBoundary>
    </>
  )
}
