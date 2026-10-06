import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { listLibraryItems, libraryKeys } from '@/api/library'
import {
  createProjectCollection,
  listProjectCollections,
  listProjectResources,
  projectResourceKeys,
  removeProjectResource,
} from '@/api/projectResources'
import type { ProjectResource } from '@/api/schemas/projectResources'
import { usePreferences } from '@/app/preferencesContext'
import { NeutralState } from '@/components/Badges'
import { BidiText } from '@/components/BidiText'
import { Button, ButtonLink } from '@/components/Button'
import { ConfirmAction } from '@/components/ConfirmAction'
import { Pagination } from '@/components/Pagination'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { formatCode } from '@/domain/codes'
import { kindOf } from '@/domain/libraryItem'
import { useProject } from '@/features/projects/useProject'
import { AddFromLibraryDialog } from './AddFromLibraryDialog'
import { writeErrorMessage } from './writeError'
import styles from './Library.module.css'

/** Display code of a project resource: the corpus code when it points into the corpus, else RES-<id>. */
function resourceCode(r: ProjectResource): string {
  const kind = kindOf(r.resource_type)
  if (r.corpus_id && kind === 'report') return formatCode('REP', r.corpus_id)
  if (r.corpus_id && kind === 'occurrence') return formatCode('OCC', r.corpus_id)
  if (r.corpus_id && kind === 'narrator') return formatCode('NAR', r.corpus_id)
  if (r.corpus_id && kind === 'book') return formatCode('BK', r.corpus_id)
  return formatCode('RES', r.id)
}

export function ProjectResourcesPage() {
  const { t } = useTranslation()
  const { date, n } = usePreferences()
  const qc = useQueryClient()
  const { id, can } = useProject()
  const [params, setParams] = useSearchParams()
  const projectId = id ?? 0
  const code = formatCode('PRJ', projectId)
  const page = Number(params.get('page')) || 1
  const selectedId = Number(params.get('resource')) || undefined
  const canEdit = can('addShared')

  const list = useQuery({
    queryKey: projectResourceKeys.list(projectId, page),
    queryFn: ({ signal }) => listProjectResources(projectId, page, signal),
    enabled: id !== null,
  })
  const collections = useQuery({
    queryKey: projectResourceKeys.collections(projectId),
    queryFn: ({ signal }) => listProjectCollections(projectId, signal),
    enabled: id !== null,
  })
  // Whether the same source is on your personal shelf (the "Elsewhere" panel).
  const library = useQuery({
    queryKey: libraryKeys.index,
    queryFn: ({ signal }) => listLibraryItems(signal),
    enabled: id !== null,
  })

  const state = viewStateOf(list, { isEmpty: (d) => (d as { items: unknown[] }).items.length === 0 })
  const items = list.data?.items ?? []
  const selected = items.find((r) => r.id === selectedId)
  const unavailable = !!selectedId && !selected && !!list.data

  const select = (rid: number | null) => {
    const next = new URLSearchParams(params)
    if (rid) next.set('resource', String(rid))
    else next.delete('resource')
    setParams(next, { replace: true })
  }
  const goPage = (p: number) => {
    const next = new URLSearchParams(params)
    next.set('page', String(p))
    next.delete('resource')
    setParams(next, { replace: true })
  }

  // ---- collections ----
  const [creating, setCreating] = useState(false)
  const [colName, setColName] = useState('')
  const create = useMutation({
    mutationFn: (name: string) => createProjectCollection(projectId, name),
    onSuccess: () => {
      setCreating(false)
      setColName('')
      void qc.invalidateQueries({ queryKey: projectResourceKeys.collections(projectId) })
    },
  })
  const submitCollection = (e: FormEvent) => {
    e.preventDefault()
    if (colName.trim()) create.mutate(colName.trim())
  }

  // ---- remove ----
  const [fromLibrary, setFromLibrary] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const remove = useMutation({
    mutationFn: (rid: number) => removeProjectResource(projectId, rid),
    onSuccess: async () => {
      setConfirm(false)
      setError(null)
      select(null)
      await qc.invalidateQueries({ queryKey: ['project', projectId] })
      void qc.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (err) => {
      setConfirm(false)
      setError(writeErrorMessage(err, t))
    },
  })

  const total = list.data?.pagination?.total_items ?? items.length
  const colCount = collections.data?.length ?? 0

  return (
    <section>
      <div className={styles.pageHead}>
        <div>
          <h1>{t('library.projectResources.title')}</h1>
          {list.data ? (
            <p className={styles.countLine}>
              {t('library.projectResources.countLine', {
                resources: t('units.resource', { count: total, formattedCount: n(total) }),
                collections: t('library.projectResources.collectionsCount', { count: colCount, formattedCount: n(colCount) }),
              })}
            </p>
          ) : null}
        </div>
        {canEdit ? (
          <div className={styles.headActions}>
            <Button onClick={() => setFromLibrary(true)}>
              {t('library.projectResources.addFromLibrary')}
            </Button>
            <ButtonLink variant="primary" to={`/projects/${projectId}/resources/add`}>
              {t('library.projectResources.add')}
            </ButtonLink>
          </div>
        ) : null}
      </div>

      <h2 style={{ fontSize: '1.125rem', margin: '0 0 0.25rem' }}>{t('library.projectResources.heading')}</h2>
      <p className={styles.intro}>{t('library.projectResources.intro', { id: code })}</p>
      <div className={styles.separate}>
        <strong>🔒 {t('library.projectResources.separate')}</strong>
        {t('library.projectResources.separateBody')}
      </div>

      {unavailable ? (
        <div className={styles.notice} role="status" style={{ marginBlockEnd: '1rem' }}>
          <h2>{t('library.projectResources.unavailable.title')}</h2>
          <p>{t('library.projectResources.unavailable.body', { id: code })}</p>
        </div>
      ) : null}

      {error ? (
        <div className={styles.banner} role="alert" style={{ marginBlockEnd: '1rem' }}>
          <h3>{t('library.projectResources.removeFailed')}</h3>
          <p>{error}</p>
        </div>
      ) : null}

      <div className={[styles.resLayout, selected ? '' : styles.resLayoutNoDetail].join(' ')}>
        <aside className={styles.sidebar} aria-label={t('library.projectResources.collections')}>
          <div className={styles.sideGroup}>
            <h2>{t('library.projectResources.collections')}</h2>
            {(collections.data ?? []).length === 0 ? (
              <p className={styles.hintLine}>{t('library.projectResources.noCollections')}</p>
            ) : (
              <ul className={styles.sideList}>
                {(collections.data ?? []).map((c) => (
                  <li key={c.id} className={styles.sideItem}>
                    <span>
                      <BidiText>{c.name}</BidiText>
                    </span>
                    <span className={styles.sideCount}>{n(c.items_count ?? 0)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className={styles.hintLine}>{t('library.projectResources.collectionsUnavailable')}</p>
            {canEdit ? (
              creating ? (
                <form className={styles.inlineForm} onSubmit={submitCollection}>
                  <input
                    autoFocus
                    aria-label={t('library.projectResources.collectionName')}
                    placeholder={t('library.projectResources.collectionName')}
                    value={colName}
                    onChange={(e) => setColName(e.target.value)}
                  />
                  <Button type="submit" disabled={create.isPending || !colName.trim()}>
                    {t('library.projectResources.createCollection')}
                  </Button>
                </form>
              ) : (
                <button type="button" className={styles.sideNew} onClick={() => setCreating(true)}>
                  {t('library.projectResources.newCollection')}
                </button>
              )
            ) : null}
            {create.isError ? (
              <p role="alert" className={styles.hintLine}>
                {t('library.projectResources.collectionFailed')}
              </p>
            ) : null}
          </div>
        </aside>

        <div className={styles.main}>
          <StateBoundary
            state={state}
            errorValue={list.error}
            error={
              <div className={styles.banner} role="alert">
                <h2>{t('library.projectResources.loadFailed.title')}</h2>
                <p>{t('library.projectResources.loadFailed.body')}</p>
                <Button onClick={() => void list.refetch()}>{t('common.retry')}</Button>
              </div>
            }
            empty={
              <div className={styles.empty}>
                <h2>{t('library.projectResources.empty.title')}</h2>
                <p>{t('library.projectResources.empty.body')}</p>
                {canEdit ? (
                  <div className={styles.headActions}>
                    <Button onClick={() => setFromLibrary(true)}>
                      {t('library.projectResources.addFromLibrary')}
                    </Button>
                    <ButtonLink variant="primary" to={`/projects/${projectId}/resources/add`}>
                      {t('library.projectResources.add')}
                    </ButtonLink>
                  </div>
                ) : null}
              </div>
            }
          >
            <ul className={styles.items}>
              {items.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className={[styles.item, r.id === selected?.id ? styles.itemActive : ''].join(' ')}
                    aria-current={r.id === selected?.id ? 'true' : undefined}
                    onClick={() => select(r.id)}
                  >
                    <span className={styles.itemTop}>
                      <span>{t(`library.type.${kindOf(r.resource_type)}`)}</span>
                      <span>{resourceCode(r)}</span>
                    </span>
                    <span className={styles.itemTitle}>
                      <BidiText>{r.title}</BidiText>
                    </span>
                    {(r.pivot?.tags ?? []).length > 0 ? (
                      <span className={styles.itemSub}>{(r.pivot?.tags ?? []).map((x) => `#${x}`).join(' ')}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
            {list.data?.pagination ? <Pagination pagination={list.data.pagination} onPage={goPage} /> : null}
          </StateBoundary>
        </div>

        {selected ? (
          <article className={styles.detail} aria-label={selected.title}>
            <header className={styles.detailHead}>
              <div className={styles.detailKicker}>
                {t('library.projectResources.detail.kicker', { code: resourceCode(selected), id: code })}
              </div>
              <h2>
                <BidiText>{selected.title}</BidiText>
              </h2>
              {selected.corpus_id ? (
                <p className={styles.hintLine}>
                  {t('library.projectResources.detail.points', { code: resourceCode(selected) })}
                </p>
              ) : null}
            </header>

            <section className={styles.section}>
              <h3>{t('library.projectResources.detail.inProject')}</h3>
              <dl className={styles.facts}>
                <dt>{t('library.projectResources.detail.projectTags')}</dt>
                <dd>
                  {(selected.pivot?.tags ?? []).length > 0 ? (
                    (selected.pivot?.tags ?? []).map((x) => `#${x}`).join(' ')
                  ) : (
                    <NeutralState kind="unknown">{t('library.projectResources.detail.noTags')}</NeutralState>
                  )}
                  <span className={styles.hintLine} style={{ display: 'block' }}>
                    {t('library.projectResources.detail.tagsEditUnavailable')}
                  </span>
                </dd>
                <dt>{t('library.projectResources.detail.why')}</dt>
                <dd>
                  {selected.pivot?.inclusion_rationale ? (
                    <BidiText>{selected.pivot.inclusion_rationale}</BidiText>
                  ) : (
                    <NeutralState kind="unknown">{t('library.projectResources.detail.noWhy')}</NeutralState>
                  )}
                </dd>
                {selected.pivot?.created_at ? (
                  <>
                    <dt>{t('library.projectResources.detail.added')}</dt>
                    <dd>{date(selected.pivot.created_at)}</dd>
                  </>
                ) : null}
                <dt>{t('library.projectResources.detail.evidence')}</dt>
                <dd>
                  <NeutralState kind="unknown">{t('library.projectResources.detail.evidenceUnavailable')}</NeutralState>
                </dd>
              </dl>
            </section>

            <section className={styles.section}>
              <h3>{t('library.projectResources.detail.elsewhere')}</h3>
              <dl className={styles.facts}>
                <dt>{t('library.projectResources.detail.myLibrary')}</dt>
                <dd>
                  {library.data
                    ? library.data.some((l) => l.resource_id === selected.id)
                      ? t('library.projectResources.detail.inLibrary')
                      : t('library.projectResources.detail.notInLibrary')
                    : '…'}
                </dd>
                <dt>{t('library.projectResources.detail.otherProjects')}</dt>
                <dd>
                  <NeutralState kind="unknown">{t('library.projectResources.detail.otherUnavailable')}</NeutralState>
                </dd>
              </dl>
              <p className={styles.hintLine}>{t('library.projectResources.detail.rename')}</p>
            </section>

            {canEdit ? (
              <section className={styles.danger}>
                <Button variant="danger" onClick={() => setConfirm(true)}>
                  {t('library.projectResources.detail.remove')}
                </Button>
                <p>{t('library.projectResources.detail.removeNote')}</p>
              </section>
            ) : null}

            <ConfirmAction
              open={confirm}
              danger
              title={t('library.projectResources.removeDialog.title', { title: selected.title, id: code })}
              confirmLabel={t('library.projectResources.removeDialog.confirm', { id: code })}
              busy={remove.isPending}
              onCancel={() => setConfirm(false)}
              onConfirm={() => remove.mutate(selected.id)}
            >
              <p className="mono">
                {t('library.projectResources.removeDialog.kicker', { code: resourceCode(selected) })}
              </p>
              <p>{t('library.projectResources.removeDialog.tags')}</p>
              <p>{t('library.projectResources.removeDialog.kept')}</p>
            </ConfirmAction>
          </article>
        ) : null}
      </div>
      {fromLibrary ? (
        <AddFromLibraryDialog
          open
          projectId={projectId}
          existing={new Set(items.map((r) => r.id))}
          onClose={() => setFromLibrary(false)}
        />
      ) : null}
    </section>
  )
}
