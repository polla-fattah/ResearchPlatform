import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { LibraryItem } from '@/api/schemas/library'
import { NeutralState, ProvenanceTag } from '@/components/Badges'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { Pagination } from '@/components/Pagination'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { usePreferences } from '@/app/preferencesContext'
import { pickableSavedKey, type Pickable, type PickableKind } from '@/domain/pickable'
import { SEARCHABLE, searchPickables } from './search'
import type { PickerSelection } from './selection'
import { useDebounced } from './useDebounced'
import styles from './Picker.module.css'
import { qk } from '@/api/queryKeys'

const KINDS: { kind: PickableKind | 'book' | 'chapter' | 'section' | 'chain' | 'judgment' | 'passage'; key: string }[] = [
  { kind: 'book', key: 'book' },
  { kind: 'chapter', key: 'chapter' },
  { kind: 'section', key: 'section' },
  { kind: 'report', key: 'report' },
  { kind: 'occurrence', key: 'occurrence' },
  { kind: 'chain', key: 'chain' },
  { kind: 'narrator', key: 'narrator' },
  { kind: 'judgment', key: 'judgment' },
  { kind: 'passage', key: 'passage' },
]

interface Props {
  value: PickerSelection
  onChange: (next: PickerSelection) => void
  /** Library items by "corpus_table:corpus_id", for the "In My Library" badge. */
  saved: Map<string, LibraryItem>
  /** The duplicate prompt, shown between the source text and "What to save". */
  duplicate: ReactNode
  onAddExternal: () => void
  disabled?: boolean
}

export function CorpusPicker({ value, onChange, saved, duplicate, onAddExternal, disabled }: Props) {
  const { t, i18n } = useTranslation()
  const { n, date } = usePreferences()
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<PickableKind | ''>('')
  const [page, setPage] = useState(1)
  const term = useDebounced(q.trim(), 350)
  const active = term.length >= 2
  const sourceRef = useRef<HTMLDivElement>(null)

  const search = useQuery({
    queryKey: qk.corpus.picker(term, kind, page),
    queryFn: ({ signal }) => searchPickables({ q: term, kind, page }, signal),
    enabled: active,
    placeholderData: keepPreviousData,
    retry: false,
  })
  const items = search.data?.items ?? []
  const state = !active
    ? 'normal'
    : viewStateOf(search, { isEmpty: (d) => (d as { items: unknown[] }).items.length === 0 })

  const counts = {
    report: items.filter((p) => p.kind === 'report').length,
    occurrence: items.filter((p) => p.kind === 'occurrence').length,
    narrator: items.filter((p) => p.kind === 'narrator').length,
  }
  const parts = (['report', 'occurrence', 'narrator'] as const)
    .filter((k) => counts[k] > 0)
    .map((k) => t(`units.${k}`, { count: counts[k], formattedCount: n(counts[k]) }))
  let partsText = parts.join(', ')
  try {
    partsText = new Intl.ListFormat(i18n.language, { type: 'conjunction' }).format(parts)
  } catch {
    /* keep the comma list */
  }

  const select = (item: Pickable) => onChange({ item, mode: 'item', span: '', pages: '' })

  const captureSelection = () => {
    const sel = window.getSelection()
    const text = sel?.toString().trim() ?? ''
    if (!text || !sourceRef.current || !sel?.anchorNode || !sourceRef.current.contains(sel.anchorNode)) return
    onChange({ ...value, mode: 'span', span: text })
  }

  const item = value.item
  const savedItem = item ? saved.get(pickableSavedKey(item) ?? '') : undefined

  return (
    <div className={styles.layout}>
      <div>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.125rem' }}>{t('picker.find')}</h2>
        <input
          type="search"
          className={styles.search}
          aria-label={t('picker.searchLabel')}
          placeholder={t('picker.searchPlaceholder')}
          value={q}
          disabled={disabled}
          dir="auto"
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
        />
        <p className={styles.hint}>{t('picker.searchHint')}</p>

        <div className={styles.chips} role="group" aria-label={t('picker.typeLabel')}>
          {KINDS.map(({ kind: k, key }) => {
            const searchable = (SEARCHABLE as readonly string[]).includes(k)
            return (
              <button
                key={key}
                type="button"
                className={[styles.chip, kind === k ? styles.chipOn : ''].join(' ')}
                aria-pressed={kind === k}
                disabled={!searchable}
                title={searchable ? undefined : t('picker.types.notSearchable')}
                onClick={() => {
                  setKind(kind === k ? '' : (k as PickableKind))
                  setPage(1)
                }}
              >
                {t(`picker.types.${key}`)}
              </button>
            )
          })}
        </div>

        {!active ? <p className={styles.hint}>{t('picker.typeAtLeast')}</p> : null}

        <StateBoundary
          state={state}
          errorValue={search.error}
          error={
            <div className={styles.banner} role="alert">
              <h2>{t('picker.searchFailedTitle')}</h2>
              <p>{t('picker.searchFailedBody', { q: term })}</p>
              <Button onClick={() => void search.refetch()}>{t('common.retry')}</Button>
            </div>
          }
          empty={
            <div className={styles.empty}>
              <h2>{t('picker.noMatchTitle', { q: term })}</h2>
              <p>{t('picker.noMatchBody')}</p>
              <Button onClick={onAddExternal}>{t('picker.addExternal')}</Button>
            </div>
          }
        >
          {active ? (
            <>
              <p className={styles.counts}>{t('picker.counts', { count: items.length, parts: partsText })}</p>
              <ul className={styles.results}>
                {items.map((p) => {
                  const savedRow = saved.get(pickableSavedKey(p) ?? '')
                  return (
                    <li key={p.key}>
                      <button
                        type="button"
                        className={[styles.result, item?.key === p.key ? styles.resultOn : ''].join(' ')}
                        aria-pressed={item?.key === p.key}
                        onClick={() => select(p)}
                      >
                        <span className={styles.resultTop}>
                          <span>{t(`picker.kind.${p.kind}`)}</span>
                          <span className="mono">{p.code}</span>
                          {savedRow ? <span className={styles.saved}>{t('picker.inLibrary')}</span> : null}
                        </span>
                        <span className={styles.resultTitle}>
                          <BidiText>{p.title}</BidiText>
                        </span>
                        <span className={styles.hint}>{p.loc}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {search.data?.pagination ? (
                <div style={{ marginBlockStart: '1rem' }}>
                  <Pagination pagination={search.data.pagination} onPage={setPage} />
                </div>
              ) : null}
            </>
          ) : null}
        </StateBoundary>
      </div>

      <div>
        {item ? (
          <div className={styles.detail}>
            <div>
              <span className={styles.hint}>
                {item.kind === 'report' ? t('picker.reportLong') : t(`picker.kind.${item.kind}`)}
              </span>
              <h2>
                <BidiText>{item.title}</BidiText>
              </h2>
            </div>
            <dl className={styles.facts}>
              <dt>{t('picker.idLabel')}</dt>
              <dd className="mono">{item.code}</dd>
              <dt>{t('picker.locatorLabel')}</dt>
              <dd>
                <BidiText>{item.locator}</BidiText>
                {item.gaps.includes('page') ? (
                  <>
                    {' '}
                    <NeutralState kind="unknown">{t('picker.unknownPage')}</NeutralState>
                  </>
                ) : null}
              </dd>
              <dt />
              <dd className={styles.hint}>{t('picker.snapshotNote')}</dd>
            </dl>

            {item.text ? (
              <div>
                <ProvenanceTag kind="source" /> <span className={styles.hint}>{t('picker.originalText')}</span>
                <div
                  ref={sourceRef}
                  className={styles.source}
                  onMouseUp={captureSelection}
                  onKeyUp={captureSelection}
                  data-testid="source-text"
                >
                  <BidiText as="div" lang="ar">
                    {item.text}
                  </BidiText>
                </div>
                {item.textIsReportLevel ? (
                  <p className={styles.hint}>
                    <NeutralState kind="limitation" /> {t('picker.reportLevelText')}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className={styles.hint}>{t('picker.noText')}</p>
            )}

            {savedItem && item ? (
              <span className="visually-hidden">
                {t('picker.inLibrary')}
                {savedItem.created_at ? ` · ${date(savedItem.created_at)}` : ''}
              </span>
            ) : null}
            {duplicate}

            {item.kind !== 'narrator' ? (
              <fieldset style={{ border: 0, padding: 0, margin: 0 }} disabled={disabled}>
                <legend style={{ fontWeight: 500, marginBlockEnd: '0.5rem' }}>{t('picker.what.title')}</legend>
                <div className={styles.options}>
                  {(
                    [
                      ['item', t('picker.what.item', { kind: t(`picker.kind.${item.kind}`).toLowerCase() }), t('picker.what.itemSub')],
                      ['span', t('picker.what.span'), t('picker.what.spanSub')],
                      ['page', t('picker.what.page'), t('picker.what.pageSub')],
                    ] as const
                  ).map(([mode, label, sub]) => (
                    <label
                      key={mode}
                      className={[styles.choice, value.mode === mode ? styles.choiceOn : ''].join(' ')}
                    >
                      <input
                        type="radio"
                        name="excerpt"
                        checked={value.mode === mode}
                        onChange={() => onChange({ ...value, mode })}
                      />
                      <span>
                        {label}
                        <small>{sub}</small>
                      </span>
                    </label>
                  ))}
                </div>
                {value.mode === 'span' ? (
                  <div style={{ marginBlockStart: '0.5rem' }}>
                    {value.span ? (
                      <>
                        <strong>{t('picker.what.selected')}</strong>
                        <BidiText as="blockquote" style={{ margin: '0.25rem 0' }}>
                          {value.span}
                        </BidiText>
                        <button
                          type="button"
                          className={styles.chip}
                          onClick={() => onChange({ ...value, span: '' })}
                        >
                          {t('picker.what.clear')}
                        </button>
                      </>
                    ) : (
                      <p className={styles.hint}>{t('picker.what.noneSelected')}</p>
                    )}
                  </div>
                ) : null}
                {value.mode === 'page' ? (
                  <label style={{ display: 'block', marginBlockStart: '0.5rem' }}>
                    {t('picker.what.pages')}
                    <input
                      className={styles.search}
                      value={value.pages}
                      placeholder={t('picker.what.pagesPlaceholder')}
                      onChange={(e) => onChange({ ...value, pages: e.target.value })}
                    />
                  </label>
                ) : null}
              </fieldset>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
