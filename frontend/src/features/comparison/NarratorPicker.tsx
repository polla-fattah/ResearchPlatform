import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { listNarrators } from '@/api/corpus'
import { qk } from '@/api/queryKeys'
import type { CorpusNarrator } from '@/api/schemas/corpus'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { narratorCode } from './comparisonModel'
import styles from './Comparison.module.css'

interface Props {
  /** Narrators already chosen; they are not offered again. */
  exclude?: readonly number[]
  onPick: (narrator: CorpusNarrator) => void
}

/** Look a narrator up by name in the corpus and choose one. The search runs when asked, not on every key. */
export function NarratorPicker({ exclude = [], onPick }: Props) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const [term, setTerm] = useState('')

  const results = useQuery({
    queryKey: qk.corpus.narratorLookup(term),
    queryFn: ({ signal }) => listNarrators(term, signal),
    enabled: term.length >= 2,
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTerm(draft.trim())
  }
  const choices = (results.data ?? []).filter((n) => !exclude.includes(n.id))

  return (
    <div className={styles.search}>
      <form onSubmit={submit} role="search" aria-label={t('comparison.narrators.search')}>
        <label className={styles.hint} htmlFor="narrator-search">
          {t('comparison.narrators.search')}
        </label>
        <div className={styles.barActions}>
          <input id="narrator-search" dir="auto" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <Button type="submit" disabled={draft.trim().length < 2}>
            {t('comparison.narrators.searchButton')}
          </Button>
        </div>
      </form>
      {results.isPending && term.length >= 2 ? <p role="status">{t('states.loading.label')}</p> : null}
      {results.isError ? <p role="alert">{t('comparison.narrators.failed')}</p> : null}
      {results.data && choices.length === 0 ? <p className={styles.hint}>{t('comparison.narrators.none')}</p> : null}
      {choices.length > 0 ? (
        <ul className={styles.suggest} aria-label={t('comparison.narrators.results')}>
          {choices.map((n) => (
            <li key={n.id}>
              <button type="button" onClick={() => onPick(n)}>
                <BidiText>{n.name}</BidiText> <span className={styles.code}>{narratorCode(n.id)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
