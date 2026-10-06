import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { getStructure } from '@/api/bookStructure'
import { qk } from '@/api/queryKeys'
import type { BookStructure } from '@/api/schemas/bookStructure'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { RefreshNotice } from '@/components/RefreshNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { parseNarratorId } from '@/features/narrator/narratorModel'
import { useProject } from '@/features/projects/useProject'
import { useDraftParam, useQueryParams } from '@/hooks/useQueryParams'
import { BookList } from './BookList'
import { bookCode, chapterLabel, filterChapters } from './bookModel'
import { ChapterPanel } from './ChapterPanel'
import { ConcordancePanel } from './ConcordancePanel'
import styles from './Books.module.css'

const VIEWS = ['contents', 'words'] as const
const STEP = 100

/**
 * Screen 31. A collection of the corpus: its chapters with how many occurrences each holds, the reports of a chapter,
 * and a word-form concordance. The design's critic-expression index, corpus snapshots and licence notices have no
 * endpoint behind them and are not drawn (request file C-38); every count is the server's, none is computed here.
 */
export function BookPage() {
  const { id: projectId } = useProject()
  const bookId = parseNarratorId(useParams().bookId)
  if (projectId === null) return null
  const base = `/projects/${projectId}/analysis/books`
  if (bookId === null) return <BookList base={base} />
  return <Book bookId={bookId} base={base} />
}

function Book({ bookId, base }: { bookId: number; base: string }) {
  const { t } = useTranslation()
  const url = useQueryParams()
  const view = url.oneOf('view', VIEWS, 'contents')
  const structure = useQuery({ queryKey: qk.corpus.structure(bookId), queryFn: ({ signal }) => getStructure(bookId, signal), retry: false })
  const state = structure.data ? 'normal' : viewStateOf(structure)
  const s = structure.data

  return (
    <section aria-label={t('books.title')}>
      <StateBoundary state={state} errorValue={structure.error} onRetry={() => void structure.refetch()}>
        <RefreshNotice query={structure} what={t('books.title')} />
        {s ? (
          <>
            <p className={styles.meta}>
              <span className="mono">{bookCode(s.book_id)}</span> · <Link to={base}>{t('books.allBooks')}</Link>
            </p>
            <h1>
              <BidiText>{s.book_title}</BidiText>
            </h1>
            {s.author?.name ? (
              <p>
                <BidiText>{s.author.name}</BidiText>
              </p>
            ) : null}
            <p className={styles.note} role="note">
              {t('books.unchecked')}
            </p>
            <div className={styles.tabs} role="group" aria-label={t('books.views')}>
              {VIEWS.map((v) => (
                <Button key={v} className={styles.tab} aria-current={v === view} onClick={() => url.replaceAll({ view: v === 'contents' ? '' : v }, { push: true })}>
                  {t(`books.view.${v}`)}
                </Button>
              ))}
            </div>
            {view === 'contents' ? <Contents structure={s} /> : <ConcordancePanel bookId={bookId} bookTitle={s.book_title} />}
          </>
        ) : null}
      </StateBoundary>
    </section>
  )
}

function Contents({ structure }: { structure: BookStructure }) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const url = useQueryParams()
  const filter = useDraftParam('chapters', { delay: 300 })
  const selected = url.id('chapter')
  const matches = filterChapters(structure.chapters, url.text('chapters'))
  const open = structure.chapters.find((c) => c.chapter_id === selected) ?? null
  const position = open ? structure.chapters.indexOf(open) + 1 : 0

  return (
    <div>
      <p>
        {t('books.contents.totals', { chapters: n(structure.total_chapters), occurrences: n(structure.total_occurrences) })}
      </p>
      <div className={styles.split}>
        <div>
          <label htmlFor="chapter-filter">{t('books.contents.filter')}</label>
          <input id="chapter-filter" dir="auto" value={filter.text} onChange={(e) => filter.setText(e.target.value)} onKeyDown={(e) => (e.key === 'Enter' ? filter.commit() : undefined)} />
          <ChapterList key={url.text('chapters')} matches={matches} all={structure.chapters} selected={selected} onPick={(id) => url.set({ chapter: id }, { push: true })} />
        </div>
        <div>
          {open ? (
            <ChapterPanel key={open.chapter_id} bookId={structure.book_id} chapterId={open.chapter_id} title={chapterLabel(open, position)} count={open.occurrence_count} page={url.page} onPage={(p) => url.set({ page: p }, { keepPage: true })} />
          ) : (
            <div className={styles.empty}>
              <p>{selected ? t('books.contents.notFound') : t('books.contents.pick')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ChapterList({ matches, all, selected, onPick }: { matches: BookStructure['chapters']; all: BookStructure['chapters']; selected: number | undefined; onPick: (id: number) => void }) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const [shown, setShown] = useState(STEP)
  if (matches.length === 0) return <p className={styles.meta}>{t('books.contents.noMatch')}</p>
  return (
    <>
      <ul className={styles.list} aria-label={t('books.contents.chapters')}>
        {matches.slice(0, shown).map((c) => (
          <li key={c.chapter_id}>
            <button type="button" className={styles.item} aria-current={c.chapter_id === selected} onClick={() => onPick(c.chapter_id)}>
              <span className={styles.itemTitle}>
                <BidiText>{chapterLabel(c, all.indexOf(c) + 1)}</BidiText>
              </span>
              <span className={styles.meta}>{t('books.contents.occurrences', { count: c.occurrence_count, n: n(c.occurrence_count) })}</span>
            </button>
          </li>
        ))}
      </ul>
      {matches.length > shown ? (
        <Button onClick={() => setShown(shown + STEP)}>{t('books.contents.more', { shown: n(shown), total: n(matches.length) })}</Button>
      ) : null}
    </>
  )
}
