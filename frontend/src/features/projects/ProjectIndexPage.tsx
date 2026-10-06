import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { listProjects, projectKeys, type ListProjectsParams } from '@/api/projects'
import { userMessage } from '@/api/errors'
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

const SCOPES: ProjectScope[] = ['owned', 'shared', 'archived', 'trash']
const SORTS = ['recent', 'title', 'created'] as const
type Sort = (typeof SORTS)[number]

const isScope = (v: string | null): v is ProjectScope => !!v && (SCOPES as string[]).includes(v)
const isSort = (v: string | null): v is Sort => !!v && (SORTS as readonly string[]).includes(v)

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
  const [params, setParams] = useSearchParams()

  const scope: ProjectScope = isScope(params.get('scope')) ? (params.get('scope') as ProjectScope) : 'owned'
  const q = params.get('q') ?? ''
  const stage = params.get('stage') ?? ''
  const tag = params.get('tag') ?? ''
  const sort: Sort = isSort(params.get('sort')) ? (params.get('sort') as Sort) : 'recent'
  const page = Number(params.get('page')) || 1

  const update = (changes: Record<string, string | null>, keepPage = false) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    if (!keepPage) next.delete('page')
    setParams(next, { replace: true })
  }

  // The search box is typed into freely and applied to the URL a moment later.
  const [typed, setTyped] = useState(q)
  useEffect(() => setTyped(q), [q])
  useEffect(() => {
    if (typed === q) return
    const id = setTimeout(() => update({ q: typed || null }), 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed])

  const listParams: ListProjectsParams = {
    scope,
    q: q || undefined,
    stage: stage || undefined,
    tag: tag || undefined,
    page,
    per_page: 20,
  }
  const query = useQuery({
    queryKey: projectKeys.list(listParams),
    queryFn: ({ signal }) => listProjects(listParams, signal),
    placeholderData: keepPreviousData,
  })
  // A failed refetch keeps showing the last good list, dimmed, under a banner
  // (design: "Projects couldn't be filtered"). TanStack drops placeholder data on error, so remember it.
  const [lastGood, setLastGood] = useState<typeof query.data>(undefined)
  useEffect(() => {
    if (query.data && !query.isPlaceholderData) setLastGood(query.data)
  }, [query.data, query.isPlaceholderData])
  const data = query.data ?? (query.isError ? lastGood : undefined)
  const filtered = !!(q || stage || tag)
  const state = viewStateOf(
    query.isError && data ? { ...query, isError: false, data } : query,
    { isEmpty: (d) => (d as { items: unknown[] }).items.length === 0 },
  )

  const rows = useMemo(() => sortRows(data?.items ?? [], sort), [data, sort])
  const tags = useMemo(
    () => [...new Set((data?.items ?? []).flatMap((p) => p.tags ?? []).concat(tag ? [tag] : []))].sort(),
    [data, tag],
  )

  // ---- row actions ----
  const [pending, setPending] = useState<{ action: 'trash' | 'leave'; project: ProjectListItem } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const act = useMutation({
    mutationFn: async ({ action, project }: { action: RowAction; project: ProjectListItem }) => {
      if (action === 'archive' || action === 'unarchive') return toggleArchive(project.id)
      if (action === 'trash') return trashProject(project.id)
      if (action === 'restore') return restoreProject(project.id)
      return leaveProject(project.id)
    },
    onSuccess: () => {
      setActionError(null)
      setPending(null)
      void qc.invalidateQueries({ queryKey: projectKeys.all })
    },
    onError: (err) => {
      setPending(null)
      setActionError(userMessage(err, t('states.error.body')))
    },
  })

  const onAction = (action: RowAction, project: ProjectListItem) => {
    if (action === 'trash' || action === 'leave') setPending({ action, project })
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

  const restoreDate = date(new Date(Date.now() + 30 * 86_400_000))

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
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
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
            onChange={(e) => update({ sort: e.target.value === 'recent' ? null : e.target.value }, true)}
          >
            <option value="recent">{t('projects.index.filters.recent')}</option>
            <option value="title">{t('projects.index.filters.title')}</option>
            <option value="created">{t('projects.index.filters.created')}</option>
          </select>
        </div>
      ) : null}

      {actionError ? (
        <div className={styles.banner} role="alert">
          <h2>{t('projects.index.actionFailed')}</h2>
          <p>{actionError}</p>
        </div>
      ) : null}

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
            <Pagination pagination={data.pagination} onPage={(p) => update({ page: String(p) }, true)} />
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
            <p>{t('projects.index.trashDialog.restore', { date: restoreDate })}</p>
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
