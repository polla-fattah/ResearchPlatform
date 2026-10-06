import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { listBooks } from '@/api/corpus'
import { qk } from '@/api/queryKeys'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Pagination } from '@/components/Pagination'
import { RefreshNotice } from '@/components/RefreshNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { useQueryParams } from '@/hooks/useQueryParams'
import { bookCode } from './bookModel'
import styles from './Books.module.css'

/** The collections of the corpus, a page at a time, to choose one to open. */
export function BookList({ base }: { base: string }) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const url = useQueryParams()
  const page = url.page
  const list = useQuery({ queryKey: qk.corpus.books(page), queryFn: ({ signal }) => listBooks(page, 20, signal) })
  const view = list.data ? 'normal' : viewStateOf(list)
  return (
    <section aria-label={t('books.title')}>
      <h1>{t('books.title')}</h1>
      <p>{t('books.choose')}</p>
      <StateBoundary state={view} errorValue={list.error} onRetry={() => void list.refetch()}>
        <RefreshNotice query={list} what={t('books.list')} />
        {list.data && list.data.data.length === 0 ? <p className={styles.empty}>{t('books.noBooks')}</p> : null}
        <ul className={styles.list} aria-label={t('books.list')}>
          {(list.data?.data ?? []).map((b) => (
            <li key={b.id}>
              <Link className={styles.item} to={`${base}/${b.id}`}>
                <span className={styles.itemTitle}>
                  <BidiText>{b.title}</BidiText>
                </span>
                <span className={styles.meta}>
                  <span className="mono">{bookCode(b.id)}</span>
                  {b.author?.name ? <> · <BidiText>{b.author.name}</BidiText></> : null}
                  {b.references_count !== undefined ? <> · {t('books.occurrences', { count: b.references_count, n: n(b.references_count) })}</> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {list.data?.pagination ? <Pagination pagination={list.data.pagination} onPage={(p) => url.set({ page: p }, { keepPage: true })} /> : null}
      </StateBoundary>
    </section>
  )
}
