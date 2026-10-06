import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { deleteEdge, deleteNode, getGraph } from '@/api/argument'
import { exportArgumentGraph } from '@/api/graphExport'
import { invalidate } from '@/api/invalidate'
import { qk } from '@/api/queryKeys'
import type { ArgumentEdge, ArgumentNode } from '@/api/schemas/argument'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { ConfirmAction } from '@/components/ConfirmAction'
import { MutationNotice } from '@/components/MutationNotice'
import { RefreshNotice } from '@/components/RefreshNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { evidenceCode } from '@/features/evidence/evidenceModel'
import { graphFileName } from '@/features/exchange/exchangeModel'
import { useProject } from '@/features/projects/useProject'
import { findingCode } from '@/features/writing/writingModel'
import { useQueryParams } from '@/hooks/useQueryParams'
import { PointDialog, RelationDialog } from './ArgumentDialogs'
import { buildOutline, isNodeType, isReasoningOnly, isRelation, linkedFindings, mapOfFinding } from './argumentModel'
import styles from './Argument.module.css'

const GraphCanvas = lazy(() => import('./GraphCanvas'))
const VIEWS = ['outline', 'graph'] as const

type Dialog = { kind: 'point'; parent: ArgumentNode | null; existing: ArgumentNode | null } | { kind: 'relation'; source: ArgumentNode } | { kind: 'delete'; node: ArgumentNode } | null

/**
 * Screen 32. The project's argument map: points (premises, claims, objections, replies, qualifications, alternative
 * conclusions) and the relations between them, as an outline and as a graph. The server keeps one map per PROJECT
 * (the design draws one per finding), so the screen can narrow it to the points connected to one finding. A removed
 * point is gone for good, there is no history and no export (request file C-39).
 */
export function ArgumentPage() {
  const { t, i18n } = useTranslation()
  const qc = useQueryClient()
  const { id: projectId, can } = useProject()
  const url = useQueryParams()
  const [dialog, setDialog] = useState<Dialog>(null)
  const pid = projectId ?? 0
  const canEdit = can('editShared')
  const view = url.oneOf('view', VIEWS, 'outline')
  const selected = url.id('node')
  const findingFilter = url.id('finding')

  const graph = useQuery({ queryKey: qk.project(pid).argument, queryFn: ({ signal }) => getGraph(pid, signal), enabled: projectId !== null })
  const removeNode = useMutation({
    mutationFn: (n: ArgumentNode) => deleteNode(pid, n.id),
    onSuccess: async (_, n) => {
      await invalidate.argumentChanged(qc, pid)
      if (selected === n.id) url.set({ node: '' })
      setDialog(null)
    },
  })
  const exportFile = useMutation({ mutationFn: () => exportArgumentGraph(pid, graphFileName(pid)) })
  const removeEdge = useMutation({ mutationFn: (e: ArgumentEdge) => deleteEdge(pid, e.id), onSuccess: () => invalidate.argumentChanged(qc, pid) })

  if (projectId === null) return null
  const all = graph.data
  const scoped = all && findingFilter ? mapOfFinding(all.nodes, all.edges, findingFilter) : all
  const nodes = scoped?.nodes ?? []
  const edges = scoped?.edges ?? []
  const { rows, loops } = buildOutline(nodes, edges)
  const open = nodes.find((n) => n.id === selected) ?? null
  const state = all ? 'normal' : viewStateOf(graph)
  const typeLabel = (type: string) => (isNodeType(type) ? t(`argument.types.${type}`) : type)
  const relationLabel = (r: string) => (isRelation(r) ? t(`argument.relations.${r}`) : r)

  return (
    <section aria-label={t('argument.title')}>
      <h1>{t('argument.title')}</h1>
      <p className={styles.sub}>{t('argument.sub')}</p>
      <p className={styles.note} role="note">
        {t('argument.unchecked')}
      </p>
      <StateBoundary state={state} errorValue={graph.error} onRetry={() => void graph.refetch()}>
        <RefreshNotice query={graph} what={t('argument.title')} />
        {all && all.nodes.length === 0 ? (
          <div className={styles.empty}>
            <h2>{t('argument.empty.title')}</h2>
            <p>{t('argument.empty.body')}</p>
            {canEdit ? (
              <Button variant="primary" onClick={() => setDialog({ kind: 'point', parent: null, existing: null })}>
                {t('argument.empty.add')}
              </Button>
            ) : (
              <p className={styles.meta}>{t('argument.readOnly')}</p>
            )}
          </div>
        ) : all ? (
          <>
            <div className={styles.head}>
              <div className={styles.tabs} role="group" aria-label={t('argument.views')}>
                {VIEWS.map((v) => (
                  <Button key={v} className={styles.tab} aria-current={v === view} onClick={() => url.set({ view: v === 'outline' ? '' : v }, { push: true })}>
                    {t(`argument.view.${v}`)}
                  </Button>
                ))}
              </div>
              <div className={styles.actions}>
                {linkedFindings(all.nodes).length > 0 ? (
                  <label>
                    {t('argument.filter')}{' '}
                    <select value={findingFilter ?? ''} onChange={(e) => url.set({ finding: e.target.value })}>
                      <option value="">{t('argument.filterAll')}</option>
                      {linkedFindings(all.nodes).map((f) => (
                        <option key={f.id} value={f.id}>
                          {findingCode(f.id)}
                          {f.label ? ` · ${f.label.slice(0, 50)}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <Button onClick={() => exportFile.mutate()} disabled={exportFile.isPending}>
                  {t('argument.export.button')}
                </Button>
                {canEdit ? <Button onClick={() => setDialog({ kind: 'point', parent: null, existing: null })}>{t('argument.addTop')}</Button> : null}
              </div>
            </div>
            {exportFile.data ? (
              <p role="status">{t('argument.export.saved', { file: graphFileName(pid), points: exportFile.data.summary.total_nodes, relations: exportFile.data.summary.total_edges })}</p>
            ) : null}
            <MutationNotice error={exportFile.error} title={t('argument.export.failed')} />
            {!canEdit ? <p className={styles.meta}>{t('argument.readOnly')}</p> : null}
            <div className={styles.split}>
              <div>
                {view === 'outline' ? (
                  <>
                    <ul className={styles.outline} aria-label={t('argument.outline')}>
                      {rows.map((r) => (
                        <li key={`${r.number}`} style={{ marginInlineStart: `${r.depth * 1.5}rem` }}>
                          <button type="button" className={styles.point} aria-current={r.node.id === selected} onClick={() => url.set({ node: r.node.id }, { push: true })}>
                            <span className="mono">{r.number}</span> · <span className={styles.rel}>{typeLabel(r.node.node_type)}</span>
                            {r.relation ? <span className={styles.meta}> · {relationLabel(r.relation)}</span> : null}
                            <br />
                            <BidiText>{r.node.title}</BidiText>
                            {isReasoningOnly(r.node) ? <span className={styles.meta}> · {t('argument.reasoningOnly')}</span> : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                    {loops.length > 0 ? (
                      <div className={styles.note} role="alert">
                        <p>{t('argument.loops')}</p>
                        <ul>
                          {loops.map((n) => (
                            <li key={n.id}>
                              <button type="button" className={styles.point} onClick={() => url.set({ node: n.id }, { push: true })}>
                                <BidiText>{n.title}</BidiText>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <Suspense fallback={<p role="status">{t('states.loading.label')}</p>}>
                    <GraphCanvas rows={rows} edges={edges} selected={selected ?? null} onSelect={(id) => url.set({ node: id ?? '' })} rtl={i18n.dir() === 'rtl'} label={t('argument.graphLabel')} typeLabel={typeLabel} relationLabel={relationLabel} />
                    <p className={styles.meta}>{t('argument.graphNote')}</p>
                  </Suspense>
                )}
              </div>
              <div>
                {open ? (
                  <NodePanel
                    node={open}
                    nodes={all.nodes}
                    edges={all.edges}
                    projectId={projectId}
                    canEdit={canEdit}
                    typeLabel={typeLabel}
                    relationLabel={relationLabel}
                    removing={removeEdge.isPending}
                    removeError={removeEdge.error}
                    onAnswer={() => setDialog({ kind: 'point', parent: open, existing: null })}
                    onEdit={() => setDialog({ kind: 'point', parent: null, existing: open })}
                    onRelate={() => setDialog({ kind: 'relation', source: open })}
                    onDelete={() => setDialog({ kind: 'delete', node: open })}
                    onRemoveRelation={(e) => removeEdge.mutate(e)}
                  />
                ) : (
                  <div className={styles.empty}>
                    <p>{selected ? t('argument.notFound') : t('argument.pick')}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </StateBoundary>

      {dialog?.kind === 'point' ? <PointDialog projectId={projectId} parent={dialog.parent} existing={dialog.existing} onClose={() => setDialog(null)} onSaved={(id) => { setDialog(null); url.set({ node: id }) }} /> : null}
      {dialog?.kind === 'relation' && all ? <RelationDialog projectId={projectId} source={dialog.source} nodes={all.nodes} edges={all.edges} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === 'delete' ? (
        <ConfirmAction open danger busy={removeNode.isPending} title={t('argument.delete.title', { title: dialog.node.title })} confirmLabel={t('argument.delete.confirm')} onConfirm={() => removeNode.mutate(dialog.node)} onCancel={() => setDialog(null)}>
          <p>{t('argument.delete.body')}</p>
          <MutationNotice error={removeNode.error} title={t('argument.delete.failed')} />
        </ConfirmAction>
      ) : null}
    </section>
  )
}

function NodePanel({
  node,
  nodes,
  edges,
  projectId,
  canEdit,
  typeLabel,
  relationLabel,
  removing,
  removeError,
  onAnswer,
  onEdit,
  onRelate,
  onDelete,
  onRemoveRelation,
}: {
  node: ArgumentNode
  nodes: readonly ArgumentNode[]
  edges: readonly ArgumentEdge[]
  projectId: number
  canEdit: boolean
  typeLabel: (t: string) => string
  relationLabel: (r: string) => string
  removing: boolean
  removeError: unknown
  onAnswer: () => void
  onEdit: () => void
  onRelate: () => void
  onDelete: () => void
  onRemoveRelation: (e: ArgumentEdge) => void
}) {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const titleOf = (id: number) => nodes.find((n) => n.id === id)?.title ?? `#${id}`
  const answers = edges.filter((e) => e.source_node_id === node.id)
  const answeredBy = edges.filter((e) => e.target_node_id === node.id)
  return (
    <article className={styles.detail} aria-label={node.title}>
      <p className={styles.meta}>
        <span className={styles.rel}>{typeLabel(node.node_type)}</span>
        {node.created_at ? <> · {date(node.created_at)}</> : null}
      </p>
      <h2>
        <BidiText>{node.title}</BidiText>
      </h2>
      <p className={styles.snippet}>
        <BidiText>{node.content}</BidiText>
      </p>

      <h3>{t('argument.source.title')}</h3>
      {node.evidence ? (
        <div>
          <p>
            <Link to={`/projects/${projectId}/evidence?item=${node.evidence.id}`}>{evidenceCode(node.evidence.id)}</Link>
            {node.evidence.locator ? <span className={styles.meta}> · {node.evidence.locator}</span> : null}
          </p>
          {node.evidence.captured_text ? (
            <p>
              <BidiText>{node.evidence.captured_text}</BidiText>
            </p>
          ) : null}
        </div>
      ) : (
        <p className={styles.meta}>{t('argument.source.none')}</p>
      )}
      {node.finding_id ? (
        <p className={styles.meta}>
          {t('argument.source.finding')}: <Link to={`/projects/${projectId}/findings/${node.finding_id}`}>{findingCode(node.finding_id)}</Link>
        </p>
      ) : null}

      <h3>{t('argument.relations.title')}</h3>
      <RelationList label={t('argument.relations.answers')} empty={t('argument.relations.answersNone')} edges={answers} pick={(e) => e.target_node_id} titleOf={titleOf} relationLabel={relationLabel} canEdit={canEdit} busy={removing} onRemove={onRemoveRelation} />
      <RelationList label={t('argument.relations.answeredBy')} empty={t('argument.relations.answeredByNone')} edges={answeredBy} pick={(e) => e.source_node_id} titleOf={titleOf} relationLabel={relationLabel} canEdit={canEdit} busy={removing} onRemove={onRemoveRelation} />
      <MutationNotice error={removeError} title={t('argument.relations.removeFailed')} />

      {canEdit ? (
        <div className={styles.actions}>
          <Button variant="primary" onClick={onAnswer}>
            {t('argument.actions.answer')}
          </Button>
          <Button onClick={onRelate}>{t('argument.actions.relate')}</Button>
          <Button onClick={onEdit}>{t('argument.actions.edit')}</Button>
          <Button onClick={onDelete}>{t('argument.actions.delete')}</Button>
        </div>
      ) : null}
    </article>
  )
}

function RelationList({ label, empty, edges, pick, titleOf, relationLabel, canEdit, busy, onRemove }: { label: string; empty: string; edges: readonly ArgumentEdge[]; pick: (e: ArgumentEdge) => number; titleOf: (id: number) => string; relationLabel: (r: string) => string; canEdit: boolean; busy: boolean; onRemove: (e: ArgumentEdge) => void }) {
  const { t } = useTranslation()
  return (
    <>
      <p className={styles.meta}>{label}</p>
      {edges.length === 0 ? (
        <p className={styles.meta}>{empty}</p>
      ) : (
        <ul className={styles.alts} aria-label={label}>
          {edges.map((e) => (
            <li key={e.id}>
              <span className={styles.rel}>{relationLabel(e.relation_type)}</span> <BidiText>{titleOf(pick(e))}</BidiText>
              {canEdit ? (
                <>
                  {' '}
                  <Button onClick={() => onRemove(e)} disabled={busy} aria-label={t('argument.relations.removeOf', { title: titleOf(pick(e)) })}>
                    {t('argument.relations.remove')}
                  </Button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
