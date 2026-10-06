import { useQueries } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { getHadith } from '@/api/corpus'
import { qk } from '@/api/queryKeys'
import { BidiText } from '@/components/BidiText'
import { Pagination } from '@/components/Pagination'
import { reportCode } from '@/features/comparison/comparisonModel'
import { excerpt } from '@/features/books/bookModel'
import { PAGE_SIZE, pageOf, totalPages } from './compareModel'
import styles from './SearchCompare.module.css'

/** One list of the comparison, ten records at a time. Each record's wording is fetched from the corpus only for the page shown. */
export function ChangeList({ ids, page, onPage, label, empty, base }: { ids: readonly number[]; page: number; onPage: (p: number) => void; label: string; empty: string; base: string }) {
  const { t } = useTranslation()
  const shown = pageOf(ids, page)
  const hadiths = useQueries({ queries: shown.map((id) => ({ queryKey: qk.corpus.hadith(id), queryFn: ({ signal }: { signal: AbortSignal }) => getHadith(id, signal), retry: false })) })
  if (ids.length === 0) return <p className={styles.empty}>{empty}</p>
  const pages = totalPages(ids.length)
  return (
    <>
      <ul className={styles.members} aria-label={label}>
        {shown.map((id, i) => {
          const h = hadiths[i]
          return (
            <li key={id} className={styles.member}>
              <div>
                <strong className="mono">
                  <Link to={`${base}/analysis?view=occ&h=${id}`}>{reportCode(id)}</Link>
                </strong>
                {h?.isPending ? <p className={styles.meta}>{t('states.loading.label')}</p> : null}
                {h?.isError ? <p className={styles.meta}>{t('searchCompare.recordUnavailable')}</p> : null}
                {h?.data ? (
                  <p>
                    <BidiText>{excerpt(h.data.matn)}</BidiText>
                  </p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
      <Pagination pagination={{ current_page: page, per_page: PAGE_SIZE, total_items: ids.length, total_pages: pages, has_more: page < pages }} onPage={onPage} />
    </>
  )
}
