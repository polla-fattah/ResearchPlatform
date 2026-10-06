import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { invalidate } from '@/api/invalidate'
import { isnadTopology, topologyOf } from '@/api/isnad'
import { qk } from '@/api/queryKeys'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { MutationNotice } from '@/components/MutationNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { analysisCode, idsParam, MAX_CHAINS, MAX_REPORTS, MIN_REPORTS, parseIds } from '@/features/comparison/comparisonModel'
import { SelectReportsDialog } from '@/features/comparison/SelectReportsDialog'
import { useChainsOfReports, useRun, useRuns } from '@/features/comparison/useComparison'
import { useProject } from '@/features/projects/useProject'
import { useQueryParams } from '@/hooks/useQueryParams'
import { chainsThrough, generationCount, layoutLayers, narratorRows, numeric } from './isnadModel'
import { NarratorTable } from './NarratorTable'
import styles from './Isnad.module.css'

// React Flow is large and only this screen draws a graph, so it is loaded when the graph is first shown.
const GraphCanvas = lazy(() => import('./GraphCanvas'))

/**
 * Screen 27. The chosen reports, the narrator in focus, "only chains through here" and whether the graph is drawn are in
 * the address (?h= &node= &through=1 &graph=0), and ?run= opens a stored graph. The graph is the server's; the table beside
 * it holds the same facts and is the way a keyboard or a screen reader reads it. The server's common-link rule is shown as a
 * rule of thumb, never as a proof, and its "formal proof" block is not shown at all (request file C-34).
 */
export function IsnadPage() {
  const { t, i18n } = useTranslation()
  const { n, date } = usePreferences()
  const qc = useQueryClient()
  const { id: projectId, can } = useProject()
  const url = useQueryParams()
  const [selecting, setSelecting] = useState(false)
  const pid = projectId ?? 0
  const canEdit = can('addShared')

  const ids = parseIds(url.text('h'), MAX_REPORTS)
  const runId = url.id('run')
  const focus = url.text('node') || null
  const through = url.text('through') === '1'
  const showGraph = url.text('graph') !== '0'

  const { loaded, sources, shown, compare } = useChainsOfReports(pid, runId ? [] : ids)
  const sanadIds = shown.map((s) => s.sanadId)
  const topo = useQuery({
    queryKey: qk.project(pid).compare.topology(sanadIds),
    queryFn: ({ signal }) => isnadTopology(pid, sanadIds, false, signal).then((r) => r.topology),
    enabled: !runId && projectId !== null && sanadIds.length >= 2,
    retry: false,
    staleTime: Infinity,
  })
  const stored = useRun(pid, runId)
  const runs = useRuns(pid)
  const savedRuns = (runs.data ?? []).filter((r) => r.analysis_type === 'isnad_topology')
  const save = useMutation({ mutationFn: () => isnadTopology(pid, sanadIds, true), onSuccess: () => invalidate.analysesChanged(qc, pid) })

  if (projectId === null) return null

  const storedTopology = stored.data ? topologyOf(stored.data) : null
  const topology = runId ? storedTopology : (topo.data ?? null)
  const rows = topology ? narratorRows(topology) : []
  const selectedRow = rows.find((r) => r.id === focus) ?? null
  const edges = topology?.graph_topology.edges ?? []
  const candidates = rows.filter((r) => r.candidate)
  const chains = compare.data ? chainsThrough(compare.data.chains, through && selectedRow ? selectedRow.numericId : null) : []
  const waiting = !runId && ids.length >= MIN_REPORTS && (loaded.pending || (sanadIds.length >= 2 && topo.isPending))
  const view = runId ? viewStateOf(stored) : waiting ? 'loading' : topo.isError ? 'error' : 'normal'
  const rtl = i18n.dir() === 'rtl'

  const go = (changes: Record<string, string | number | null>) => url.set(changes, { push: true, keepPage: true })
  const pick = (id: string | null) => url.set({ node: id, through: id ? (through ? '1' : null) : null }, { keepPage: true })

  return (
    <section aria-label={t('isnad.title')}>
      <div className={styles.bar}>
        <h1>{runId && stored.data ? t('isnad.storedTitle', { code: analysisCode(stored.data.id), version: stored.data.version_number }) : t('isnad.title')}</h1>
        <p className={styles.sub}>{t('isnad.sub')}</p>
      </div>
      <p className={styles.note} role="note">
        {t('isnad.unchecked')}
      </p>

      {!runId ? (
        <div className={styles.controls}>
          <Button variant="primary" onClick={() => setSelecting(true)}>
            {ids.length === 0 ? t('isnad.pick') : t('isnad.change')}
          </Button>
          <label className={styles.check}>
            <input type="checkbox" checked={showGraph} onChange={(e) => url.set({ graph: e.target.checked ? null : '0' }, { keepPage: true })} /> {t('isnad.showGraph')}
          </label>
        </div>
      ) : (
        <p>
          <Link to={`/projects/${projectId}/analysis/isnad`}>{t('isnad.backToNew')}</Link>
        </p>
      )}

      <StateBoundary state={view} errorValue={runId ? stored.error : topo.error} onRetry={() => void (runId ? stored.refetch() : topo.refetch())}>
        {!runId && ids.length < MIN_REPORTS ? (
          <div className={styles.empty}>
            <h2>{t('isnad.empty.title')}</h2>
            <p>{t('isnad.empty.body')}</p>
            <Button variant="primary" onClick={() => setSelecting(true)}>
              {t('isnad.pick')}
            </Button>
          </div>
        ) : null}
        {!runId && ids.length >= MIN_REPORTS && !loaded.pending && sanadIds.length < 2 ? <p className={styles.note}>{t('isnad.fewChains', { count: sanadIds.length })}</p> : null}
        {!runId && loaded.missing.length > 0 ? <p className={styles.note}>{t('isnad.missing', { ids: loaded.missing.join(', ') })}</p> : null}
        {!runId && loaded.failed ? <p className={styles.note} role="alert">{t('isnad.loadFailed')}</p> : null}
        {!runId && sources.length > MAX_CHAINS ? <p className={styles.note}>{t('isnad.truncated', { max: n(MAX_CHAINS), total: n(sources.length) })}</p> : null}
        {runId && stored.data && !storedTopology ? <p className={styles.note}>{t('isnad.notGraph')}</p> : null}

        {topology ? (
          <>
            <ul className={styles.summary} aria-label={t('isnad.summary.label')}>
              <li>{t('isnad.summary.chains', { count: topology.total_sanads_analyzed ?? 0, formattedCount: n(topology.total_sanads_analyzed ?? 0) })}</li>
              <li>{t('isnad.summary.narrators', { count: rows.length, formattedCount: n(rows.length) })}</li>
              <li>{t('isnad.summary.links', { count: edges.length, formattedCount: n(edges.length) })}</li>
              <li>{t('isnad.generations', { count: generationCount(layoutLayers(topology.graph_topology.nodes, edges)), formattedCount: n(generationCount(layoutLayers(topology.graph_topology.nodes, edges))) })}</li>
            </ul>

            <section className={styles.candidates} aria-label={t('isnad.candidates.title')}>
              <h2>{t('isnad.candidates.title')}</h2>
              {candidates.length === 0 ? (
                <p>{t('isnad.candidates.none')}</p>
              ) : (
                <ul>
                  {candidates.map((c) => (
                    <li key={c.id}>
                      <button type="button" className={styles.link} onClick={() => pick(c.id)}>
                        <BidiText>{c.name}</BidiText>
                      </button>{' '}
                      — {t('isnad.candidates.line', { chains: n(c.chains), students: n(c.students.length) })}
                    </li>
                  ))}
                </ul>
              )}
              <p className={styles.hint}>{t('isnad.candidates.rule')}</p>
            </section>

            <div className={styles.layout}>
              <div>
                {showGraph ? (
                  <Suspense fallback={<p className={styles.hint}>{t('states.loading.label')}</p>}>
                    <GraphCanvas
                      rows={rows}
                      edges={edges}
                      selected={selectedRow?.id ?? null}
                      onSelect={pick}
                      rtl={rtl}
                      label={t('isnad.graphLabel')}
                      roleLabel={(role) => t(`isnad.roles.${role}`)}
                      countLabel={(c) => t('isnad.onChains', { count: c, formattedCount: n(c) })}
                    />
                  </Suspense>
                ) : null}
                <p className={styles.hint}>{t('isnad.arrows')}</p>
                <h2>{t('isnad.table.title')}</h2>
                <NarratorTable rows={rows} selected={selectedRow?.id ?? null} onSelect={(id) => pick(id === selectedRow?.id ? null : id)} />
              </div>

              <aside aria-label={t('isnad.panel.title')}>
                {selectedRow ? (
                  <section className={styles.panel}>
                    <h2>
                      <BidiText>{selectedRow.name}</BidiText>
                    </h2>
                    <dl className={styles.facts}>
                      <dt>{t('isnad.table.role')}</dt>
                      <dd>{t(`isnad.roles.${selectedRow.role}`)}</dd>
                      <dt>{t('isnad.table.chains')}</dt>
                      <dd>{t('isnad.onChains', { count: selectedRow.chains, formattedCount: n(selectedRow.chains) })}</dd>
                      <dt>{t('isnad.table.teachers')}</dt>
                      <dd>{selectedRow.teachers.length > 0 ? selectedRow.teachers.map((x) => x.name).join(' · ') : t('isnad.table.none')}</dd>
                      <dt>{t('isnad.table.students')}</dt>
                      <dd>{selectedRow.students.length > 0 ? selectedRow.students.map((x) => x.name).join(' · ') : t('isnad.table.none')}</dd>
                    </dl>
                    <div className={styles.actions}>
                      {numeric(selectedRow.id) !== null ? (
                        <Link to={`/projects/${projectId}/analysis?view=dossier&narrator=${selectedRow.id}`}>{t('isnad.panel.dossier')}</Link>
                      ) : null}
                      {!runId ? (
                        <label className={styles.check}>
                          <input type="checkbox" checked={through} onChange={(e) => url.set({ through: e.target.checked ? '1' : null }, { keepPage: true })} /> {t('isnad.panel.through')}
                        </label>
                      ) : null}
                    </div>
                  </section>
                ) : (
                  <p className={styles.hint}>{t('isnad.panel.pick')}</p>
                )}
              </aside>
            </div>

            {!runId ? (
              <section aria-label={t('isnad.chains.title')}>
                <h2>{t('isnad.chains.title')}</h2>
                {compare.isPending ? <p className={styles.hint}>{t('states.loading.label')}</p> : null}
                {compare.isError ? <p className={styles.note}>{t('isnad.chains.failed')}</p> : null}
                <ul className={styles.chains}>
                  {chains.map((c) => (
                    <li key={c.sanad_id} className={styles.chain}>
                      <span className={styles.tag}>{t('isnad.chains.sanad', { id: c.sanad_id })}</span>{' '}
                      <BidiText>{[...c.narrators].sort((a, b) => a.order - b.order).map((x) => x.name).join(' ← ')}</BidiText>
                    </li>
                  ))}
                </ul>
                <p className={styles.hint}>{t('isnad.chains.note')}</p>
              </section>
            ) : null}

            {!runId && canEdit && sanadIds.length >= 2 ? (
              <div className={styles.actions}>
                <Button onClick={() => save.mutate()} disabled={save.isPending}>
                  {t('isnad.save')}
                </Button>
                {save.data?.saved ? <span role="status">{t('isnad.savedAs', { code: analysisCode(save.data.saved.id), version: save.data.saved.version_number })}</span> : null}
              </div>
            ) : null}
            <MutationNotice error={save.error} title={t('isnad.saveFailed')} />
            {!runId && !canEdit ? <p className={styles.sub}>{t('isnad.readOnly')}</p> : null}
          </>
        ) : null}
      </StateBoundary>

      <h2>{t('isnad.saved.title')}</h2>
      {savedRuns.length === 0 ? (
        <p className={styles.sub}>{t('isnad.saved.none')}</p>
      ) : (
        <ul className={styles.runs}>
          {savedRuns.map((r) => (
            <li key={r.id}>
              <button type="button" className={styles.link} onClick={() => go({ run: r.id, h: null, node: null, through: null })}>
                {analysisCode(r.id)} · {t('isnad.saved.version', { version: r.version_number })}
              </button>
              {r.created_at ? <span className={styles.sub}> · {date(r.created_at)}</span> : null}
            </li>
          ))}
        </ul>
      )}

      {selecting ? (
        <SelectReportsDialog
          projectId={projectId}
          initial={ids}
          onClose={() => setSelecting(false)}
          onApply={(picked) => {
            setSelecting(false)
            go({ h: idsParam(picked), node: null, through: null, run: null })
          }}
        />
      ) : null}
    </section>
  )
}
