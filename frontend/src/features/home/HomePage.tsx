import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { countMyOpenTasks, countUnreadNotifications, listMyExports } from '@/api/home'
import { listProjects } from '@/api/projects'
import { asExportState, type ExportJob } from '@/api/schemas/exports'
import type { ProjectListItem } from '@/api/schemas/project'
import { useAuth } from '@/app/authContext'
import { usePreferences } from '@/app/preferencesContext'
import { Button, ButtonLink } from '@/components/Button'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf, type ViewState } from '@/components/viewState'
import { formatCode } from '@/domain/codes'
import { ProjectCard } from './ProjectCard'
import styles from './Home.module.css'
import { qk } from '@/api/queryKeys'

/** How many recent projects Home shows; next actions come from the same list. */
const RECENT = 5
const RECENT_PARAMS = { per_page: RECENT } as const

export function HomePage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { date } = usePreferences()
  const [today] = useState(() => new Date()) // audit-ok: read once per visit by the initialiser, not on every render

  const projects = useQuery({
    queryKey: qk.projects.list(RECENT_PARAMS),
    queryFn: ({ signal }) => listProjects(RECENT_PARAMS, signal),
  })
  const state: ViewState = viewStateOf(projects, { isEmpty: (d) => (d as { items: unknown[] }).items.length === 0 })
  const name = user?.display_name ?? ''

  // A brand-new account sees two ways to start, not empty sections (design: empty state).
  if (state === 'empty') {
    return (
      <section>
        <header className={styles.header}>
          <div>
            <p className={styles.date}>{date(today, { weekday: true })}</p>
            <h1>{t('home.welcome', { name })}</h1>
          </div>
        </header>
        <h2>{t('home.startTitle')}</h2>
        <p className={styles.muted}>{t('home.startLead')}</p>
        <div className={styles.onboarding}>
          <div className={styles.step}>
            <span className={styles.stepNumber}>01</span>
            <h2>{t('home.createProjectTitle')}</h2>
            <p>{t('home.createProjectBody')}</p>
            <ButtonLink variant="primary" to="/projects/new">
              {t('home.newProject')}
            </ButtonLink>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNumber}>02</span>
            <h2>{t('home.saveSourceTitle')}</h2>
            <p>{t('home.saveSourceBody')}</p>
            <ButtonLink to="/library/add">{t('home.saveSource')}</ButtonLink>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section>
      <header className={styles.header}>
        <div>
          <p className={styles.date}>{date(today, { weekday: true })}</p>
          <h1>{t('home.welcomeBack', { name })}</h1>
        </div>
        <div className={styles.quick}>
          <ButtonLink to="/library/add">{t('home.saveSource')}</ButtonLink>
          <ButtonLink variant="primary" to="/projects/new">
            {t('home.newProject')}
          </ButtonLink>
        </div>
      </header>

      {state === 'forbidden' ? (
        <StateBoundary state="forbidden">{null}</StateBoundary>
      ) : (
        <div className={styles.layout}>
          <ProjectsSection query={projects} state={state} />
          <aside>
            <NextActionsSection
              state={state}
              projects={projects.data?.items ?? []}
              onRetry={() => void projects.refetch()}
            />
            <DownloadsSection />
            <CountsLine />
          </aside>
        </div>
      )}
    </section>
  )
}

function SectionError({ title, body, onRetry }: { title: string; body: string; onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div className={styles.panel} role="alert">
      <h3>{title}</h3>
      <p>{body}</p>
      <Button onClick={onRetry}>{t('common.retry')}</Button>
    </div>
  )
}

function ProjectsSection({
  query,
  state,
}: {
  query: UseQueryResult<Awaited<ReturnType<typeof listProjects>>>
  state: ViewState
}) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const counts = query.data?.counts

  return (
    <div className={styles.section}>
      <div className={styles.sectionHead}>
        <h2>{t('home.recentProjects')}</h2>
        {counts ? (
          <span className={styles.muted}>
            {t('home.owned', { n: n(counts.owned) })} · {t('home.shared', { n: n(counts.shared) })}
          </span>
        ) : null}
        <span className={styles.sectionLinks}>
          <Link to="/projects">{t('home.allProjects')}</Link>
        </span>
      </div>
      <StateBoundary
        state={state}
        errorValue={query.error}
        error={
          <SectionError
            title={t('home.projectsFailedTitle')}
            body={t('home.projectsFailedBody')}
            onRetry={() => void query.refetch()}
          />
        }
      >
        <ul className={styles.list}>
          {(query.data?.items ?? []).map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </ul>
      </StateBoundary>
    </div>
  )
}

function NextActionsSection({
  state,
  projects,
  onRetry,
}: {
  state: ViewState
  projects: ProjectListItem[]
  onRetry: () => void
}) {
  const { t } = useTranslation()
  const items = projects.flatMap((p) => (p.next_action ? [{ project: p, action: p.next_action }] : []))

  let body: ReactNode
  if (state === 'loading') {
    body = <StateBoundary state="loading">{null}</StateBoundary>
  } else if (state === 'error') {
    body = (
      <SectionError
        title={t('home.nextActionsFailedTitle')}
        body={t('home.nextActionsFailedBody')}
        onRetry={onRetry}
      />
    )
  } else if (items.length === 0) {
    body = <p className={styles.dashed}>{t('home.noNextActions')}</p>
  } else {
    body = (
      <ul className={styles.list}>
        {items.map(({ project, action }) => (
          <li key={project.id} className={styles.action}>
            <span>
              <span className={styles.actionLabel}>{action.label}</span>
              <span className={styles.actionContext}>
                {project.title} · {formatCode('PRJ', project.id)}
              </span>
            </span>
            <Link to={action.target}>{t('home.open')} →</Link>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHead}>
        <h2>{t('home.nextActions')}</h2>
      </div>
      {body}
    </div>
  )
}

function DownloadsSection() {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: qk.home.exports,
    queryFn: ({ signal }) => listMyExports(signal),
  })
  const state = viewStateOf(query, { isEmpty: (d) => (d as unknown[]).length === 0 })

  return (
    <div className={styles.section}>
      <div className={styles.sectionHead}>
        <h2>{t('home.downloads')}</h2>
        <span className={styles.sectionLinks}>
          <Link to="/downloads">{t('home.allDownloads')}</Link>
        </span>
      </div>
      <StateBoundary
        state={state}
        errorValue={query.error}
        empty={<p className={styles.dashed}>{t('home.noDownloads')}</p>}
        error={
          <SectionError
            title={t('home.downloadsFailedTitle')}
            body={t('home.downloadsFailedBody')}
            onRetry={() => void query.refetch()}
          />
        }
      >
        <ul className={styles.list}>
          {(query.data ?? []).map((job) => (
            <ExportRow key={job.id} job={job} />
          ))}
        </ul>
      </StateBoundary>
    </div>
  )
}

function ExportRow({ job }: { job: ExportJob }) {
  const { t } = useTranslation()
  const { relative } = usePreferences()
  const state = asExportState(job.status)
  const chip =
    state === 'running' || state === 'complete'
      ? styles.chipActive
      : state === 'failed'
        ? styles.chipFailed
        : state === 'unknown' || state === 'queued'
          ? ''
          : styles.chipNeutral // partial, cancelled, expired: dashed, never red

  const scope = t(`home.exportScope.${job.scope}`, { defaultValue: job.scope })
  const label = job.format ? `${scope} · ${job.format.toUpperCase()}` : scope

  return (
    <li className={styles.job}>
      <div className={styles.jobTop}>
        <strong>{label}</strong>
        <span className={[styles.chip, chip].join(' ')}>
          {state === 'unknown' ? job.status : t(`home.exportState.${state}`)}
        </span>
      </div>
      {/* Progress text is shown only while running; the backend's queued/complete text is not real yet (C-7). */}
      {state === 'running' && job.progress ? <div className={styles.muted}>{job.progress}</div> : null}
      <div className={styles.cardMeta}>
        {job.created_at ? <span>{t('home.requested', { when: relative(job.created_at) })}</span> : null}
        {state === 'complete' && job.expires_at ? (
          <span>{t('home.expires', { when: relative(job.expires_at) })}</span>
        ) : null}
        {job.failure_reason ? <span>{job.failure_reason}</span> : null}
        <Link to="/downloads">{t('home.viewJob')}</Link>
      </div>
    </li>
  )
}

/** "2 tasks assigned to you · 3 unread notifications". Parts that fail to load are left out. */
function CountsLine() {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const tasks = useQuery({ queryKey: qk.home.openTasks, queryFn: ({ signal }) => countMyOpenTasks(signal) })
  const unread = useQuery({ queryKey: qk.home.unread, queryFn: ({ signal }) => countUnreadNotifications(signal) })

  const parts = [
    tasks.data !== undefined ? t('home.counts.tasks', { count: tasks.data, formatted: n(tasks.data) }) : null,
    unread.data !== undefined
      ? t('home.counts.unread', { count: unread.data, formatted: n(unread.data) })
      : null,
  ].filter(Boolean)
  if (parts.length === 0) return null
  return <p className={styles.counts}>{parts.join(' · ')}</p>
}
