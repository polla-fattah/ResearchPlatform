import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { searchCorpus } from '@/api/corpus'
import { qk } from '@/api/queryKeys'
import { BidiText } from '@/components/BidiText'
import { Pagination } from '@/components/Pagination'
import { RefreshNotice } from '@/components/RefreshNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { reportCode } from '@/features/comparison/comparisonModel'
import { excerpt } from './bookModel'
import styles from './Books.module.css'

/** The reports of one chapter, ten at a time, from the corpus search with the book and the chapter as the only filters. */
export function ChapterPanel({ bookId, chapterId, title, count, page, onPage }: { bookId: number; chapterId: number; title: string; count: number; page: number; onPage: (p: number) => void }) {
  const { t } = useTranslation()
  const hits = useQuery({
    queryKey: qk.corpus.chapterHits(bookId, chapterId, page),
    queryFn: ({ signal }) => searchCorpus({ book_id: bookId, chapter_id: chapterId, page, per_page: 10 }, signal),
  })
  const view = hits.data ? 'normal' : viewStateOf(hits)
  return (
    <article className={styles.detail} aria-label={title}>
      <h2>
        <BidiText>{title}</BidiText>
      </h2>
      <p className={styles.meta}>{t('books.chapter.count', { count })}</p>
      <StateBoundary state={view} errorValue={hits.error} onRetry={() => void hits.refetch()}>
        <RefreshNotice query={hits} what={t('books.chapter.reports')} />
        {hits.data && hits.data.data.length === 0 ? <p className={styles.meta}>{t('books.chapter.none')}</p> : null}
        <ul className={styles.members} aria-label={t('books.chapter.reports')}>
          {(hits.data?.data ?? []).map((h) => {
            const here = (h.occurrences ?? []).find((o) => o.chapter?.id === chapterId) ?? h.occurrences?.[0]
            return (
              <li key={h.id} className={styles.member}>
                <div>
                  <strong className="mono">{reportCode(h.id)}</strong>
                  {here?.hadith_number != null ? <span className={styles.meta}> · {t('books.chapter.number', { number: here.hadith_number })}</span> : null}
                  <p>
                    <BidiText>{excerpt(h.matn)}</BidiText>
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
        {hits.data?.pagination ? <Pagination pagination={hits.data.pagination} onPage={onPage} /> : null}
      </StateBoundary>
      <p className={styles.meta}>{t('books.chapter.note')}</p>
    </article>
  )
}
