import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { CONCORDANCE_LIMITS, getConcordance } from '@/api/bookStructure'
import { qk } from '@/api/queryKeys'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { RefreshNotice } from '@/components/RefreshNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { useQueryParams } from '@/hooks/useQueryParams'
import { distributionRows, maybeMore, snippetShowsTerm, validTerm } from './bookModel'
import styles from './Books.module.css'

/**
 * Where a word form appears. The answer is a capped sample (the server stops at `limit` places), so the counts are
 * labelled as counts of what was returned, never as totals of the corpus, and a snippet that is only the start of the
 * text is flagged. A word form with no result is "none found here", not a proof that it is absent.
 */
export function ConcordancePanel({ bookId, bookTitle }: { bookId: number; bookTitle: string }) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const url = useQueryParams()
  const term = url.text('term')
  const inBook = url.text('scope') === 'book'
  const limit = url.oneOf('limit', ['50', '100', '200'] as const, '50')
  const [draft, setDraft] = useState<{ base: string; value: string } | null>(null)
  const text = draft && draft.base === term ? draft.value : term
  const [tooShort, setTooShort] = useState(false)
  const active = validTerm(term)

  const result = useQuery({
    queryKey: qk.corpus.concordance(term, inBook ? bookId : null, Number(limit)),
    queryFn: ({ signal }) => getConcordance(term, inBook ? bookId : null, Number(limit), signal),
    enabled: active,
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const ok = validTerm(text)
    setTooShort(!ok)
    if (ok) url.set({ term: text.trim() })
  }
  const data = result.data
  const view = !active ? 'normal' : data ? 'normal' : viewStateOf(result)

  return (
    <section aria-label={t('books.words.title')}>
      <form noValidate onSubmit={submit} className={styles.row}>
        <Field label={t('books.words.term')} requirement="required" hint={t('books.words.termHint')} error={tooShort ? t('books.words.tooShort') : undefined}>
          <input dir="auto" value={text} onChange={(e) => setDraft({ base: term, value: e.target.value })} />
        </Field>
        <Field label={t('books.words.limit')} requirement="optional">
          <select value={limit} onChange={(e) => url.set({ limit: e.target.value === '50' ? '' : e.target.value })}>
            {CONCORDANCE_LIMITS.map((l) => (
              <option key={l} value={l}>
                {t('books.words.limitOption', { count: l })}
              </option>
            ))}
          </select>
        </Field>
        <label>
          <input type="checkbox" checked={inBook} onChange={(e) => url.set({ scope: e.target.checked ? 'book' : '' })} /> {t('books.words.thisBook')}
        </label>
        <Button type="submit" variant="primary">
          {t('books.words.search')}
        </Button>
      </form>
      <p className={styles.meta}>{inBook ? t('books.words.scopeBook', { book: bookTitle }) : t('books.words.scopeAll')}</p>

      {!active ? <p className={styles.empty}>{t('books.words.start')}</p> : null}
      <StateBoundary state={view} errorValue={result.error} onRetry={() => void result.refetch()}>
        <RefreshNotice query={result} what={t('books.words.title')} />
        {data ? (
          data.total_matches === 0 ? (
            <div className={styles.empty}>
              <h2>{t('books.words.noneTitle')}</h2>
              <p>{t('books.words.noneBody', { term })}</p>
            </div>
          ) : (
            <>
              <p role="status">
                {maybeMore(data.total_matches, Number(limit)) ? t('books.words.atLeast', { count: data.total_matches, n: n(data.total_matches) }) : t('books.words.found', { count: data.total_matches, n: n(data.total_matches) })}
              </p>
              <h2>{t('books.words.byBook')}</h2>
              <ul className={styles.dist} aria-label={t('books.words.byBook')}>
                {distributionRows(data.book_distribution).map((r) => (
                  <li key={r.book}>
                    <BidiText>{r.book}</BidiText>: {n(r.count)}
                  </li>
                ))}
              </ul>
              <p className={styles.meta}>{t('books.words.byBookNote')}</p>
              <h2>{t('books.words.inContext')}</h2>
              <ul className={styles.members} aria-label={t('books.words.inContext')}>
                {data.concordance_samples.map((s) => (
                  <li key={s.reference_id} className={styles.member}>
                    <div>
                      <strong>{s.book_title ? <BidiText>{s.book_title}</BidiText> : null}</strong>
                      {s.chapter_title ? (
                        <span className={styles.meta}>
                          {' · '}
                          <BidiText>{s.chapter_title}</BidiText>
                        </span>
                      ) : null}
                      {s.number != null ? <span className={styles.meta}> · {t('books.chapter.number', { number: s.number })}</span> : null}
                      <p className={styles.snippet}>
                        <BidiText>{s.snippet}</BidiText>
                      </p>
                      {!snippetShowsTerm(s.snippet, term) ? <p className={styles.meta}>{t('books.words.notLocated')}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )
        ) : null}
      </StateBoundary>
    </section>
  )
}
