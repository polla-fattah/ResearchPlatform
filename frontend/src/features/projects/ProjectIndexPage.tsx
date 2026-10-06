import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { listProjects, type ListProjectsParams } from '@/api/projects'
import {
  leaveProject,
  restoreProject,
  toggleArchive,
  trashProject,
} from '@/api/projectDetail'
import type { ProjectListItem, ProjectScope } from '@/api/schemas/project'
import { usePreferences } from '@/app/preferencesContext'
import { Button, ButtonLink } from '@/components/Button'
import { ConfirmAction } from '@/components/ConfirmAction'
import { Pagination } from '@/components/Pagination'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { formatCode } from '@/domain/codes'
import { PROJECT_STAGES } from '@/domain/vocab'
import { ProjectRow, type RowAction } from './ProjectRow'
import styles from './Projects.module.css'
import { qk } from '@/api/queryKeys'
import { invalidate } from '@/api/invalidate'
import { useDraftParam, useQueryParams } from '@/hooks/useQueryParams'
import { useLastLoaded } from '@/hooks/useLastLoaded'
import { MutationNotice } from '@/components/MutationNotice'

const SCOPES = ['owned', 'shared', 'archived', 'trash'] as const satisfies readonly ProjectScope[]
const SORTS = ['recent', 'title', 'created'] as const
type Sort = (typeof SORTS)[number]

/** Applies the chosen order to the loaded page (the API has no `sort` yet, request file C-12). */
function sortRows(rows: ProjectListItem[], sort: Sort): ProjectListItem[] {
  const copy = [...rows]
  if (sort === 'title') copy.sort((a, b) => a.title.localeCompare(b.title))
  if (sort === 'created') copy.sort((a, b) => b.id - a.id)
  return copy // 'recent' is the order the API already returns
}

export function ProjectIndexPage() {
  const { t } = useTranslation()
  const { n, date } = usePreferences()
  const qc = useQueryClient()
  const url = useQueryParams()
  const update = url.set

  const scope: ProjectScope = url.oneOf('scope', SCOPES, 'owned')
  const q = url.text('q')
  const stage = url.text('stage')
  const tag = url.text('tag')
  const sort: Sort = url.oneOf('sort', SORTS, 'recent')
  const page = url.page

  const search = useDraftParam('q', { delay: 300 })

  const listParams: ListProjectsParams = {
    scope,
    q: q || undefined,
    stage: stage || undefined,
    tag: tag || undefined,
    page,
    per_page: 20,
  }
  const query = useQuery({
    queryKey: qk.projects.list(listParams),
    queryFn: ({ signal }) => listProjects(listParams, signal),
    placeholderData: keepPreviousData,
  })
  // A failed refetch keeps showing the last list that loaded, dimmed, under a banner (design: "Projects couldn't be
  // filtered"). TanStack drops placeholder data on error, so the list is read back from the cache.
  const previous = useLastLoaded<NonNullable<typeof query.data>>(qk.projects.lists)
  const data = query.data ?? (query.isError ? previous : undefined)
  const filtered = !!(q || stage || tag)
  const state = viewStateOf(
    query.isError && data ? { ...query, isError: false, data } : query,
    { isEmpty: (d) => (d as { items: unknown[] }).items.length === 0 },
  )

  const rows = sortRows(data?.items ?? [], sort)
  const tags = [...new Set((data?.items ?? []).flatMap((p) => p.tags ?? []).concat(tag ? [tag] : []))].sort()

  // ---- row actions ----
  const [pending, setPending] = useState<{ action: 'trash' | 'leave'; project: ProjectListItem; restoreBy: Date } | null>(null)

  const act = useMutation({
    mutationFn: async ({ action, project }: { action: RowAction; project: ProjectListItem }) => {
      if (action === 'archive' || action === 'unarchive') return toggleArchive(project.id)
      if (action === 'trash') return trashProject(project.id)
      if (action === 'restore') return restoreProject(project.id)
      return leaveProject(project.id)
    },
    onSuccess: () => {
      setPending(null)
      void invalidate.projectLifecycle(qc)
    },
    onError: () => setPending(null),
  })

  const onAction = (action: RowAction, project: ProjectListItem) => {
    // The recovery deadline is worked out when the dialog is opened, not on every render.
    if (action === 'trash' || action === 'leave') setPending({ action, project, restoreBy: new Date(Date.now() + 30 * 86_400_000) }) // audit-ok: event handler
    else act.mutate({ action, project })
  }

  const counts = data?.counts
  const countLine = !counts
    ? ''
    : scope === 'shared'
      ? t('projects.index.countLineShared', { shared: n(counts.shared) })
      : counts.owned + counts.archived + counts.trash === 0 && state === 'empty'
        ? t('projects.index.noneYet')
        : t('projects.index.countLine', {
            active: n(counts.owned),
            archived: n(counts.archived),
            trash: n(counts.trash),
          })


  return (
    <section>
      <div className={styles.pageHead}>
        <div>
          <h1>{t('projects.index.title')}</h1>
          {countLine ? <p className={styles.countLine}>{countLine}</p> : null}
        </div>
        <ButtonLink variant="primary" to="/projects/new">
          {t('projects.index.new')}
        </ButtonLink>
      </div>

      <nav className={styles.tabs} aria-label={t('projects.index.title')}>
        {SCOPES.map((s) => (
          <Link
            key={s}
            to={`/projects?scope=${s}`}
            className={[styles.tab, s === scope ? styles.tabActive : ''].join(' ')}
            aria-current={s === scope ? 'page' : undefined}
          >
            {t(`projects.index.tabs.${s}`, { n: counts ? n(counts[s]) : '…' })}
          </Link>
        ))}
      </nav>

      {scope === 'trash' ? <p className={styles.note}>{t('projects.index.recovery')}</p> : null}

      {!(state === 'empty' && !filtered) ? (
        <div className={styles.filters}>
          <input
            type="search"
            className={styles.search}
            aria-label={t('projects.index.filters.search')}
            placeholder={t('projects.index.filters.search')}
            value={search.text}
            onChange={(e) => search.setText(e.target.value)}
          />
          <select
            aria-label={t('projects.index.filters.stage')}
            value={stage}
            onChange={(e) => update({ stage: e.target.value || null })}
          >
            <option value="">{t('projects.index.filters.stageAll')}</option>
            {PROJECT_STAGES.map((s) => (
              <option key={s} value={s}>
                {t(`stage.${s}`)}
              </option>
            ))}
          </select>
          <select
            aria-label={t('projects.index.filters.tag')}
            value={tag}
            onChange={(e) => update({ tag: e.target.value || null })}
          >
            <option value="">{t('projects.index.filters.tagAll')}</option>
            {tags.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
          <select
            aria-label={t('projects.index.filters.sort')}
            value={sort}
            onChange={(e) => update({ sort: e.target.value === 'recent' ? null : e.target.value }, { keepPage: true })}
          >
            <option value="recent">{t('projects.index.filters.recent')}</option>
            <option value="title">{t('projects.index.filters.title')}</option>
            <option value="created">{t('projects.index.filters.created')}</option>
          </select>
        </div>
      ) : null}

      <MutationNotice error={act.error} title={t('projects.index.actionFailed')} />

      {query.isError && data ? (
        <div className={styles.banner} role="alert">
          <h2>{t('projects.index.filterFailedTitle')}</h2>
          <p>{t('projects.index.filterFailedBody', { q })}</p>
          <Button onClick={() => void query.refetch()}>{t('common.retry')}</Button>
        </div>
      ) : null}

      <StateBoundary
        state={state}
        errorValue={query.error}
        error={
          <div className={styles.banner} role="alert">
            <h2>{t('projects.index.loadFailedTitle')}</h2>
            <p>{t('projects.index.loadFailedBody')}</p>
            <Button onClick={() => void query.refetch()}>{t('common.retry')}</Button>
          </div>
        }
        empty={<EmptyState scope={scope} filtered={filtered} />}
      >
        <ul className={[styles.list, query.isError ? styles.dim : ''].join(' ')}>
          {rows.map((p) => (
            <ProjectRow key={p.id} project={p} scope={scope} busy={act.isPending} onAction={onAction} />
          ))}
        </ul>
        {data?.pagination ? (
          <div style={{ marginBlockStart: '1.25rem' }}>
            <Pagination pagination={data.pagination} onPage={(p) => update({ page: String(p) }, { keepPage: true })} />
          </div>
        ) : null}
      </StateBoundary>

      <ConfirmAction
        open={pending?.action === 'trash'}
        danger
        title={t('projects.index.trashDialog.title', { title: pending?.project.title ?? '' })}
        confirmLabel={t('projects.index.trashDialog.confirm')}
        busy={act.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && act.mutate(pending)}
      >
        {pending?.action === 'trash' ? (
          <>
            <p className="mono">
              {t('projects.index.trashDialog.kicker', { code: formatCode('PRJ', pending.project.id) })}
            </p>
            <p>{t('projects.index.trashDialog.readOnly')}</p>
            <p>{t('projects.index.trashDialog.restore', { date: date(pending.restoreBy) })}</p>
            <p>
              {t('projects.index.trashDialog.goesWith', {
                evidence: t('units.evidence', { count: pending.project.evidence_count ?? 0, formattedCount: n(pending.project.evidence_count ?? 0) }),
                findings: t('units.finding', { count: pending.project.finding_count ?? 0, formattedCount: n(pending.project.finding_count ?? 0) }),
              })}
            </p>
          </>
        ) : null}
      </ConfirmAction>

      <ConfirmAction
        open={pending?.action === 'leave'}
        danger
        title={t('projects.index.leaveDialog.title', { title: pending?.project.title ?? '' })}
        confirmLabel={t('projects.index.leaveDialog.confirm')}
        busy={act.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && act.mutate(pending)}
      >
        <p>{t('projects.index.leaveDialog.body')}</p>
      </ConfirmAction>
    </section>
  )
}

function EmptyState({ scope, filtered }: { scope: ProjectScope; filtered: boolean }) {
  const { t } = useTranslation()
  const key = filtered ? 'filtered' : scope
  return (
    <div className={styles.empty}>
      <h2>{t(`projects.index.empty.${key}.title`)}</h2>
      <p>{t(`projects.index.empty.${key}.body`)}</p>
      {scope === 'owned' && !filtered ? (
        <>
          <div className={styles.firstSteps}>
            <div>
              <strong>{t('projects.index.firstSteps.question')}</strong>
              {t('projects.index.firstSteps.questionBody')}
            </div>
            <div>
              <strong>{t('projects.index.firstSteps.workspace')}</strong>
              {t('projects.index.firstSteps.workspaceBody')}
            </div>
            <div>
              <strong>{t('projects.index.firstSteps.stages')}</strong>
              {t('projects.index.firstSteps.stagesBody')}
            </div>
          </div>
          <ButtonLink variant="primary" to="/projects/new">
            {t('projects.index.firstSteps.create')}
          </ButtonLink>
        </>
      ) : null}
    </div>
  )
}
