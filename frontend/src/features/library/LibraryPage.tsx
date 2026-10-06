import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import {
  createCollection,
  getLibraryItem,
  libraryManageKeys,
  listCollections,
  listLibrary,
  listTags,
  type LibraryQuery,
} from '@/api/libraryManage'
import type { LibraryItem } from '@/api/schemas/library'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button, ButtonLink } from '@/components/Button'
import { Pagination } from '@/components/Pagination'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { FILTER_TYPES, kindOf, libraryCode, shortLocator } from '@/domain/libraryItem'
import { LibraryDetail } from './LibraryDetail'
import { useDebounced } from '../picker/useDebounced'
import styles from './Library.module.css'

const SAVED = ['7', '30'] as const

function daysAgo(days: number, now: Date): string {
  const d = new Date(now.getTime() - days * 86_400_000)
  return d.toISOString().slice(0, 10)
}

export function LibraryPage() {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [now] = useState(() => new Date())

  const scope = params.get('scope') === 'favourites' ? 'favourites' : 'all'
  const collection = Number(params.get('collection')) || undefined
  const tag = params.get('tag') ?? ''
  const type = params.get('type') ?? ''
  const saved = params.get('saved') ?? ''
  const q = params.get('q') ?? ''
  const page = Number(params.get('page')) || 1
  const selectedId = Number(params.get('item')) || undefined

  const update = (changes: Record<string, string | null>, keepPage = false) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    if (!keepPage) next.delete('page')
    setParams(next, { replace: true })
  }

  const [typed, setTyped] = useState(q)
  useEffect(() => setTyped(q), [q])
  const debounced = useDebounced(typed, 300)
  useEffect(() => {
    if (debounced !== q) update({ q: debounced || null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  const query: LibraryQuery = {
    q: q || undefined,
    is_favourite: scope === 'favourites' ? true : undefined,
    collection_id: collection,
    resource_type: type || undefined,
    tag: tag || undefined,
    saved_from: saved ? daysAgo(Number(saved), now) : undefined,
    page,
    per_page: 20,
  }
  const list = useQuery({
    queryKey: libraryManageKeys.list(query),
    queryFn: ({ signal }) => listLibrary(query, signal),
    placeholderData: keepPreviousData,
  })
  const collections = useQuery({ queryKey: libraryManageKeys.collections, queryFn: ({ signal }) => listCollections(signal) })
  const tags = useQuery({ queryKey: libraryManageKeys.tags, queryFn: ({ signal }) => listTags(signal) })

  const filtered = !!(q || tag || type || saved || collection || scope === 'favourites')
  const state = viewStateOf(list, { isEmpty: (d) => (d as { items: unknown[] }).items.length === 0 })

  // The selected item usually is in the loaded page; otherwise ask for it directly (it may not be ours).
  const inPage = list.data?.items.find((i) => i.id === selectedId)
  const direct = useQuery({
    queryKey: libraryManageKeys.item(selectedId ?? 0),
    queryFn: ({ signal }) => getLibraryItem(selectedId!, signal),
    enabled: !!selectedId && !!list.data && !inPage,
    retry: false,
  })
  const selected: LibraryItem | undefined = inPage ?? direct.data
  const itemUnavailable = !!selectedId && !selected && direct.isError

  // ---- sidebar: new collection ----
  const [creating, setCreating] = useState(false)
  const [colName, setColName] = useState('')
  const create = useMutation({
    mutationFn: (name: string) => createCollection(name),
    onSuccess: () => {
      setCreating(false)
      setColName('')
      void qc.invalidateQueries({ queryKey: ['library'] })
    },
  })
  const submitCollection = (e: FormEvent) => {
    e.preventDefault()
    if (colName.trim()) create.mutate(colName.trim())
  }

  const counts = list.data?.counts
  const countLine = counts
    ? t('library.countLine', {
        total: n(counts.total_saved),
        favourites: n(counts.favourites_count),
        collections: n(counts.collections_count),
      })
    : ''
  const isEmptyLibrary = state === 'empty' && !filtered

  return (
    <section>
      <div className={styles.pageHead}>
        <div>
          <h1>{t('library.title')}</h1>
          {countLine ? <p className={styles.countLine}>{countLine}</p> : null}
        </div>
        <div className={styles.headActions}>
          <ButtonLink to="/library/add?tab=external">{t('library.addExternal')}</ButtonLink>
          <ButtonLink variant="primary" to="/library/add">
            {t('library.saveFromCorpus')}
          </ButtonLink>
        </div>
      </div>

      {itemUnavailable ? (
        <div className={styles.notice} role="status" style={{ marginBlockEnd: '1rem' }}>
          <h2>{t('library.unavailable.title')}</h2>
          <p>{t('library.unavailable.body')}</p>
        </div>
      ) : null}

      {isEmptyLibrary ? (
        <div className={styles.empty}>
          <h2>{t('library.empty.title')}</h2>
          <p>{t('library.empty.body')}</p>
          <div className={styles.steps}>
            <p>
              <strong>01 {t('library.empty.step1')}</strong>
              {t('library.empty.step1Body')}
            </p>
            <p>
              <strong>02 {t('library.empty.step2')}</strong>
              {t('library.empty.step2Body')}
            </p>
            <p>
              <strong>03 {t('library.empty.step3')}</strong>
              {t('library.empty.step3Body')}
            </p>
          </div>
        </div>
      ) : (
        <div className={[styles.layout, selected ? '' : styles.layoutNoDetail].join(' ')}>
          <aside className={styles.sidebar} aria-label={t('library.title')}>
            <div className={styles.sideGroup}>
              <ul className={styles.sideList}>
                {(['all', 'favourites'] as const).map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      className={[styles.sideItem, scope === s && !collection ? styles.sideItemActive : ''].join(' ')}
                      aria-current={scope === s && !collection ? 'true' : undefined}
                      onClick={() => update({ scope: s === 'all' ? null : s, collection: null })}
                    >
                      <span>{t(`library.scope.${s}`)}</span>
                      <span className={styles.sideCount}>
                        {counts ? n(s === 'all' ? counts.total_saved : counts.favourites_count) : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.sideGroup}>
              <h2>{t('library.collections.heading')}</h2>
              <ul className={styles.sideList}>
                {(collections.data ?? []).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={[styles.sideItem, collection === c.id ? styles.sideItemActive : ''].join(' ')}
                      aria-current={collection === c.id ? 'true' : undefined}
                      onClick={() => update({ collection: String(c.id), scope: null })}
                    >
                      <span>
                        <BidiText>{c.name}</BidiText>
                      </span>
                      <span className={styles.sideCount}>{n(c.resources_count ?? 0)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {creating ? (
                <form className={styles.inlineForm} onSubmit={submitCollection}>
                  <input
                    autoFocus
                    aria-label={t('library.collections.name')}
                    placeholder={t('library.collections.name')}
                    value={colName}
                    onChange={(e) => setColName(e.target.value)}
                  />
                  <Button type="submit" disabled={create.isPending || !colName.trim()}>
                    {t('library.collections.create')}
                  </Button>
                </form>
              ) : (
                <button type="button" className={styles.sideNew} onClick={() => setCreating(true)}>
                  {t('library.collections.new')}
                </button>
              )}
              {create.isError ? (
                <p role="alert" className={styles.hintLine}>
                  {t('library.collections.createFailed')}
                </p>
              ) : null}
            </div>

            {(tags.data ?? []).length > 0 ? (
              <div className={styles.sideGroup}>
                <h2>{t('library.tagsHeading')}</h2>
                <div className={styles.tagList}>
                  {(tags.data ?? []).map((x) => (
                    <button
                      key={x}
                      type="button"
                      className={[styles.tagFilter, tag === x ? styles.tagFilterActive : ''].join(' ')}
                      aria-pressed={tag === x}
                      onClick={() => update({ tag: tag === x ? null : x })}
                    >
                      #{x}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>

          <div className={styles.main}>
            <div className={styles.filters}>
              <input
                type="search"
                aria-label={t('library.filters.search')}
                placeholder={t('library.filters.search')}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
              />
              <select
                aria-label={t('library.filters.typeLabel')}
                value={type}
                onChange={(e) => update({ type: e.target.value || null })}
              >
                <option value="">{t('library.filters.type')}</option>
                {FILTER_TYPES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {t(`library.type.${f.kind}`)}
                  </option>
                ))}
              </select>
              <select
                aria-label={t('library.filters.savedLabel')}
                value={saved}
                onChange={(e) => update({ saved: e.target.value || null })}
              >
                <option value="">{t('library.filters.saved')}</option>
                {SAVED.map((d) => (
                  <option key={d} value={d}>
                    {t(`library.filters.last${d}`)}
                  </option>
                ))}
              </select>
            </div>

            <StateBoundary
              state={state}
              errorValue={list.error}
              error={
                <div className={styles.banner} role="alert">
                  <h2>{t('library.loadFailed.title')}</h2>
                  <p>{t('library.loadFailed.body')}</p>
                  <Button onClick={() => void list.refetch()}>{t('common.retry')}</Button>
                </div>
              }
              empty={
                <div className={styles.notice}>
                  <h2>{t('library.empty.filtered')}</h2>
                  <p>{t('library.empty.filteredBody')}</p>
                </div>
              }
            >
              <ul className={[styles.items, list.isPlaceholderData ? styles.dim : ''].join(' ')}>
                {list.data?.items.map((it) => (
                  <li key={it.id}>
                    <button
                      type="button"
                      className={[styles.item, it.id === selected?.id ? styles.itemActive : ''].join(' ')}
                      aria-current={it.id === selected?.id ? 'true' : undefined}
                      onClick={() => update({ item: String(it.id) }, true)}
                    >
                      <span className={styles.itemTop}>
                        <span>{t(`library.type.${kindOf(it.resource.resource_type)}`)}</span>
                        <span>
                          {it.is_favourite ? <span aria-label={t('library.scope.favourites')}>★ </span> : null}
                          {libraryCode(it)}
                        </span>
                      </span>
                      <span className={styles.itemTitle}>
                        <BidiText>{it.resource.title}</BidiText>
                      </span>
                      {shortLocator(it) ? (
                        <span className={styles.itemSub}>
                          <BidiText>{shortLocator(it)}</BidiText>
                        </span>
                      ) : null}
                      {(it.incomplete_citation_flags ?? []).length > 0 ? (
                        <span className={styles.flag}>
                          {t(`library.flag.${it.incomplete_citation_flags![0]}`, {
                            defaultValue: t('library.flag.other'),
                          })}
                        </span>
                      ) : null}
                      {it.source_status === 'merged' ? (
                        <span className={styles.flag}>{t('library.merged.title')}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
              {list.data?.pagination ? (
                <Pagination pagination={list.data.pagination} onPage={(p) => update({ page: String(p) }, true)} />
              ) : null}
            </StateBoundary>
          </div>

          {selected ? (
            <LibraryDetail
              key={selected.id}
              item={selected}
              collections={collections.data ?? []}
              onRemoved={() => update({ item: null }, true)}
            />
          ) : null}
        </div>
      )}
    </section>
  )
}
