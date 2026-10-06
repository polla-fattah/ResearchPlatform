import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { searchCorpus, type CorpusSearchParams } from '@/api/corpus'
import { ApiError } from '@/api/errors'
import { listProjectResources } from '@/api/projectResources'
import type { SearchFilters as Filters } from '@/api/schemas/search'
import { deleteSavedQuery, listRuns, listSavedQueries, runSavedQuery } from '@/api/searchWorkspace'
import { usePreferences } from '@/app/preferencesContext'
import { Button } from '@/components/Button'
import { ConfirmAction } from '@/components/ConfirmAction'
import { Pagination } from '@/components/Pagination'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { useProject } from '@/features/projects/useProject'
import { BulkAddDialog, type Pick } from './BulkAddDialog'
import { ResultList } from './ResultList'
import { RunHistory } from './RunHistory'
import { SavedQueries } from './SavedQueries'
import { SaveSearchDialog, ResultSetDialog, type ResultSetSource } from './SearchDialogs'
import { SearchFilters } from './SearchFilters'
import {
  definitionOf,
  MIN_QUERY_LENGTH,
  occKey,
  queryCode,
  runCode,
  runOrdinal,
  type Definition,
  type SearchMode,
} from './searchModel'
import styles from './Search.module.css'
import { qk } from '@/api/queryKeys'
import { invalidate } from '@/api/invalidate'
import { useDraftParam, useQueryParams } from '@/hooks/useQueryParams'
import { MutationNotice } from '@/components/MutationNotice'
import { useKeyedSelection } from '@/hooks/useKeyedSelection'

type Dialog = null | 'save' | 'evidence' | 'resources' | { set: ResultSetSource } | { remove: number }

export function SearchPage() {
  const { t } = useTranslation()
  const { n, date } = usePreferences()
  const qc = useQueryClient()
  const { id, can } = useProject()
  const projectId = id ?? 0
  const canAdd = can('addShared')
  const url = useQueryParams()
  const update = url.set
  // The search text is applied when the form is submitted, so it has no pause.
  const search = useDraftParam('q')

  // The whole definition lives in the URL, so a search can be shared, reloaded and reopened.
  const q = url.text('q')
  const mode: SearchMode = url.oneOf('mode', ['exact', 'normalized'] as const, 'normalized')
  const filters: Filters = {
    hukm_id: url.id('hukm'),
    narrator_id: url.id('narrator'),
    narrator_label: url.text('nlabel') || undefined,
  }
  const page = url.page
  const queryId = url.id('query')
  const view = url.oneOf('view', ['search', 'history'] as const, 'search')

  const setFilters = (f: Filters) =>
    update({ hukm: f.hukm_id, narrator: f.narrator_id, nlabel: f.narrator_id ? f.narrator_label : undefined })

  const definition: Definition = { q, mode, filters }
  const [tooShort, setTooShort] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const text = search.text.trim()
    if (text.length < MIN_QUERY_LENGTH) {
      setTooShort(true)
      return
    }
    setTooShort(false)
    search.commit(text)
  }

  // ---- results ----
  const ready = q.trim().length >= MIN_QUERY_LENGTH
  const searchParams: CorpusSearchParams = {
    q: q.trim(),
    mode,
    hukm_id: filters.hukm_id,
    narrator_id: filters.narrator_id,
    page,
    per_page: 10,
  }
  const results = useQuery({
    queryKey: qk.corpus.search(searchParams),
    queryFn: ({ signal }) => searchCorpus(searchParams, signal),
    enabled: ready && view === 'search',
    placeholderData: keepPreviousData,
  })
  const hits = results.data?.data ?? []
  const totalReports = results.data?.pagination?.total_items ?? hits.length
  const occurrenceCount = hits.reduce((sum, h) => sum + (h.occurrences?.length ?? 0), 0)
  const state = !ready
    ? 'idle'
    : viewStateOf(results, { isEmpty: (d) => (d as { data: unknown[] }).data.length === 0 })

  const [dialog, setDialog] = useState<Dialog>(null)
  const [notice, setNotice] = useState<ReactNode>(null)

  // ---- saved searches and runs ----
  const saved = useQuery({
    queryKey: qk.project(projectId).search.queries,
    queryFn: ({ signal }) => listSavedQueries(projectId, signal),
    enabled: id !== null,
  })
  const queries = saved.data ?? []
  const openQuery = queries.find((s) => s.id === queryId)
  const queryUnavailable = !!queryId && !!saved.data && !openQuery

  const open = (sq: (typeof queries)[number], extra: Record<string, string | undefined> = {}) => {
    const d = definitionOf(sq)
    setTooShort(false)
    update({
      query: sq.id,
      q: d.q,
      mode: d.mode,
      hukm: d.filters.hukm_id,
      narrator: d.filters.narrator_id,
      nlabel: d.filters.narrator_label,
      view: undefined,
      ...extra,
    })
  }

  const record = useMutation({
    mutationFn: (sqId: number) => runSavedQuery(projectId, sqId),
    
    onSuccess: () => invalidate.searchChanged(qc, projectId),
  })
  // The run just recorded is the mutation's own result, and "busy" is its pending state: nothing is copied into state.
  const lastRun = record.data ?? null
  const busyId = record.isPending ? record.variables : undefined
  const runList = useQuery({
    queryKey: qk.project(projectId).search.runs,
    queryFn: ({ signal }) => listRuns(projectId, signal),
    enabled: id !== null && !!lastRun,
  })
  const runNumber = lastRun && openQuery ? runOrdinal(runList.data ?? [], openQuery.id, lastRun.id) : 0

  const remove = useMutation({
    mutationFn: (sqId: number) => deleteSavedQuery(projectId, sqId),
    onSuccess: (_d, sqId) => {
      setDialog(null)
      if (queryId === sqId) update({ query: undefined })
      void invalidate.searchChanged(qc, projectId)
    },
    onError: () => setDialog(null),
  })

  // ---- resources already in the project ----
  const resources = useQuery({
    queryKey: qk.project(projectId).resources.list(1),
    queryFn: ({ signal }) => listProjectResources(projectId, 1, signal),
    enabled: id !== null && canAdd,
  })
  const inResources = useMemo(
    () => new Set((resources.data?.items ?? []).map((r) => `${r.resource_type}:${r.corpus_id}`)),
    [resources.data],
  )

  // ---- selection (belongs to this page of these results: it is empty again when the search or page changes) ----
  const { selected, toggle, setMany, clear } = useKeyedSelection(JSON.stringify(searchParams))

  const picks: Pick[] = hits.flatMap((hit) =>
    (hit.occurrences ?? []).filter((o) => selected.has(occKey(o.id))).map((occ) => ({ hit, occ })),
  )

  const runOk = lastRun?.status === 'completed' && !lastRun.progress?.truncated
  const modeLabel = t(`search.form.modes.${mode}`)

  if (view === 'history' && openQuery) {
    return (
      <section>
        <RunHistory projectId={projectId} query={openQuery} onBack={() => update({ view: undefined })} />
      </section>
    )
  }

  return (
    <section>
      <div className={styles.pageHead}>
        <div>
          <h1>{t('search.title')}</h1>
          <p className={styles.hint}>{t('search.intro')}</p>
        </div>
        <Button
          onClick={() => {
            if (ready) setDialog('save')
            else setTooShort(true)
          }}
        >
          {t('search.save.button')}
        </Button>
      </div>

      {queryUnavailable ? (
        <div className={styles.notice} role="status">
          <strong>{t('search.saved.unavailable.title')}</strong>
          <p>{t('search.saved.unavailable.body')}</p>
        </div>
      ) : null}
      {notice ? (
        <p role="status" className={styles.success}>
          {notice}
        </p>
      ) : null}

      <details className={styles.savedBox} open={queries.length > 0 || undefined}>
        <summary>
          {t('search.saved.heading')} · {t('search.saved.count', { count: queries.length })}
        </summary>
        {saved.isError ? <p role="alert">{t('search.saved.loadFailed')}</p> : null}
        <MutationNotice error={remove.error} title={t('search.saved.deleteFailed')} />
        {saved.data ? (
          <SavedQueries
            queries={queries}
            openId={queryId}
            canEdit={canAdd}
            busyId={busyId}
            onOpen={(sq) => open(sq)}
            onRun={(sq) => {
              open(sq)
              record.mutate(sq.id)
            }}
            onHistory={(sq) => open(sq, { view: 'history' })}
            onDelete={(sq) => setDialog({ remove: sq.id })}
          />
        ) : null}
        <p className={styles.hint}>{t('search.saved.scope')}</p>
      </details>

      <form className={styles.queryForm} onSubmit={submit} role="search">
        <label className={styles.queryLabel} htmlFor="search-text">
          {t('search.form.label')}
        </label>
        <div className={styles.queryRow}>
          <input
            id="search-text"
            className={styles.queryInput}
            dir="auto"
            value={search.text}
            placeholder={t('search.form.placeholder')}
            onChange={(e) => search.setText(e.target.value)}
            aria-invalid={tooShort || undefined}
          />
          <Button type="submit" variant="primary">
            {t('search.form.run')}
          </Button>
          {openQuery && canAdd ? (
            <Button onClick={() => record.mutate(openQuery.id)} disabled={record.isPending || !ready}>
              {record.isPending ? t('search.run.recording') : t('search.run.record')}
            </Button>
          ) : null}
          {q ? (
            <Button
              variant="ghost"
              onClick={() => {
                search.reset()
                setTooShort(false)
                record.reset()
                url.replaceAll()
              }}
            >
              {t('search.form.clear')}
            </Button>
          ) : null}
        </div>
        {tooShort ? (
          <p role="alert" className={styles.bad}>
            {t('search.form.tooShort')}
          </p>
        ) : null}

        <div role="radiogroup" aria-label={t('search.form.mode')} className={styles.modes}>
          {(['exact', 'normalized'] as const).map((m) => (
            <label key={m} className={[styles.modeOption, m === mode ? styles.modeOn : ''].join(' ')}>
              <input type="radio" name="mode" checked={m === mode} onChange={() => update({ mode: m })} />
              {t(`search.form.modes.${m}`)}
            </label>
          ))}
        </div>
        <p className={styles.hint}>{t(`search.form.modeHelp.${mode}`)}</p>

        <SearchFilters filters={filters} onChange={setFilters} />
      </form>

      <MutationNotice error={record.error} title={t('search.run.failed')} />

      {lastRun && openQuery ? (
        <div className={styles.runBox} role="status">
          <strong>
            {t('search.run.recorded', {
              code: runCode(openQuery.id, runNumber),
              status: t(`search.run.status.${lastRun.status}`, { defaultValue: lastRun.status }),
            })}
          </strong>
          <p>
            {t('search.run.meta', {
              count: n(lastRun.match_count ?? 0),
              duration: n(lastRun.execution_duration_ms ?? 0),
              corpus: lastRun.corpus_version ?? '—',
              version: lastRun.query_version ?? 1,
            })}
            {lastRun.created_at ? ` · ${date(lastRun.created_at, { time: true })}` : ''}
          </p>
          {lastRun.status === 'partial' ? (
            <p>
              <strong>{t('search.run.partialTitle')}.</strong>{' '}
              {t('search.run.partialBody', {
                code: runCode(openQuery.id, runNumber),
                scanned: n(lastRun.progress?.scanned_books ?? 0),
                total: n(lastRun.progress?.total_books ?? 0),
              })}
            </p>
          ) : null}
          {lastRun.progress?.truncated ? (
            <p>
              {t('search.run.capped', {
                shown: n(lastRun.match_count ?? 0),
                total: n(lastRun.progress.total_available ?? 0),
              })}
            </p>
          ) : null}
          {canAdd ? (
            <div className={styles.runActions}>
              <Button
                disabled={!runOk}
                onClick={() =>
                  setDialog({
                    set: {
                      kind: 'run',
                      runId: lastRun.id,
                      code: runCode(openQuery.id, runNumber),
                      status: lastRun.status,
                      count: lastRun.match_count ?? 0,
                    },
                  })
                }
              >
                {t('search.run.saveAll')}
              </Button>
              {!runOk ? <span className={styles.hint}>{t('search.run.saveAllOff')}</span> : null}
              <Button variant="ghost" onClick={() => update({ view: 'history' }, { keepPage: true })}>
                {t('search.run.history')}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {ready ? (
        <p className={styles.countLine} aria-live="polite">
          {results.data
            ? `${t('search.results.countLine', {
                reports: t('search.results.reportCount', { count: totalReports, formattedCount: n(totalReports) }),
                occurrences: t('search.results.occurrenceCount', { count: occurrenceCount, formattedCount: n(occurrenceCount) }),
              })} · ${t('search.results.mode', { mode: modeLabel })}`
            : ''}
        </p>
      ) : null}

      {canAdd && ready && hits.length > 0 ? (
        <div className={styles.selectionBar} role="toolbar" aria-label={t('search.selection.none')}>
          <span>
            {selected.size > 0
              ? t('search.selection.count', { count: selected.size, formattedCount: n(selected.size) })
              : t('search.selection.none')}
          </span>
          <Button disabled={picks.length === 0} onClick={() => setDialog('resources')}>
            {t('search.selection.addResources')}
          </Button>
          <Button disabled={picks.length === 0} onClick={() => setDialog('evidence')}>
            {t('search.selection.addEvidence')}
          </Button>
          <Button disabled={picks.length === 0} onClick={() => setDialog({ set: { kind: 'selection', picks } })}>
            {t('search.selection.saveSet')}
          </Button>
          {selected.size > 0 ? (
            <Button variant="ghost" onClick={clear}>
              {t('search.selection.clear')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {!canAdd && ready && hits.length > 0 ? <p className={styles.hint}>{t('search.selection.readOnly')}</p> : null}

      {state === 'idle' ? (
        <div className={styles.empty}>
          <h2>{t('search.results.startTitle')}</h2>
          <p>{t('search.results.startBody')}</p>
        </div>
      ) : (
        <StateBoundary
          state={state}
          errorValue={results.error}
          error={
            <div className={styles.banner} role="alert">
              <h2>{t('search.results.failedTitle')}</h2>
              <p>
                {results.error instanceof ApiError && results.error.status < 500
                  ? results.error.message
                  : t('search.results.failedBody')}
              </p>
              <Button onClick={() => void results.refetch()}>{t('common.retry')}</Button>
            </div>
          }
          empty={
            <div className={styles.empty}>
              <h2>{t('search.results.emptyTitle', { mode: modeLabel })}</h2>
              <p>{t('search.results.emptyBody')}</p>
              <p>{t('search.results.emptyHints')}</p>
              <ul>
                {mode === 'exact' ? (
                  <li>
                    <Button variant="ghost" onClick={() => update({ mode: 'normalized' })}>
                      {t('search.results.switchMode')}
                    </Button>
                    {t('search.results.switchModeNote')}
                  </li>
                ) : null}
                {filters.hukm_id || filters.narrator_id ? (
                  <li>
                    <Button
                      variant="ghost"
                      onClick={() => update({ hukm: undefined, narrator: undefined, nlabel: undefined })}
                    >
                      {t('search.results.removeFilters')}
                    </Button>
                  </li>
                ) : null}
              </ul>
            </div>
          }
        >
          <div className={results.isPlaceholderData ? styles.dim : undefined}>
            <ResultList
              hits={hits}
              selected={selected}
              inResources={inResources}
              canSelect={canAdd}
              onToggle={toggle}
              onToggleGroup={setMany}
            />
            {results.data?.pagination ? (
              <Pagination pagination={results.data.pagination} onPage={(p) => update({ page: p }, { keepPage: true })} />
            ) : null}
          </div>
        </StateBoundary>
      )}

      {dialog === 'save' ? (
        <SaveSearchDialog
          projectId={projectId}
          definition={definition}
          canAddToProject={canAdd}
          onClose={() => setDialog(null)}
          onSaved={(scope, sqId) => {
            setDialog(null)
            const code = queryCode(sqId)
            if (scope === 'me') {
              setNotice(
                <>
                  {t('search.save.savedMine', { code })} <Link to="/searches">{t('search.save.openMine')}</Link>
                </>,
              )
              return
            }
            setNotice(t('search.save.saved', { code }))
            update({ query: sqId }, { keepPage: true })
          }}
        />
      ) : null}

      {dialog === 'evidence' || dialog === 'resources' ? (
        <BulkAddDialog
          kind={dialog}
          projectId={projectId}
          picks={picks}
          runId={lastRun?.id}
          onClose={() => setDialog(null)}
          onDone={() => {
            clear()
            void invalidate.resourcesChanged(qc, projectId)
          }}
        />
      ) : null}

      {dialog && typeof dialog === 'object' && 'set' in dialog ? (
        <ResultSetDialog
          projectId={projectId}
          source={dialog.set}
          onClose={() => setDialog(null)}
          onSaved={(message) => {
            setDialog(null)
            setNotice(message)
          }}
        />
      ) : null}

      <ConfirmAction
        open={!!dialog && typeof dialog === 'object' && 'remove' in dialog}
        danger
        title={t('search.saved.deleteDialog.title', {
          name: queries.find((s) => dialog && typeof dialog === 'object' && 'remove' in dialog && s.id === dialog.remove)?.name ?? '',
        })}
        confirmLabel={t('search.saved.deleteDialog.confirm')}
        busy={remove.isPending}
        onCancel={() => setDialog(null)}
        onConfirm={() => dialog && typeof dialog === 'object' && 'remove' in dialog && remove.mutate(dialog.remove)}
      >
        <p>{t('search.saved.deleteDialog.body')}</p>
      </ConfirmAction>
    </section>
  )
}
