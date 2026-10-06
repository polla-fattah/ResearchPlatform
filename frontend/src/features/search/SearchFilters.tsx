import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listNarrators } from '@/api/corpus'
import type { SearchFilters as Filters } from '@/api/schemas/search'
import { listHukms } from '@/api/searchWorkspace'
import { BidiText } from '@/components/BidiText'
import { NeutralState } from '@/components/Badges'
import { useDebounced } from '../picker/useDebounced'
import styles from './Search.module.css'
import { qk } from '@/api/queryKeys'

interface Props {
  filters: Filters
  onChange: (next: Filters) => void
}

/** The filters the corpus search understands today: ruling and narrator. Book needs a backend search (request file C-14). */
export function SearchFilters({ filters, onChange }: Props) {
  const { t } = useTranslation()
  const [typed, setTyped] = useState('')
  const term = useDebounced(typed.trim(), 300)

  const hukms = useQuery({ queryKey: qk.corpus.hukms, queryFn: ({ signal }) => listHukms(signal), staleTime: Infinity })
  const narrators = useQuery({
    queryKey: qk.corpus.narratorLookup(term),
    queryFn: ({ signal }) => listNarrators(term, signal),
    enabled: term.length >= 2 && !filters.narrator_id,
  })

  const hukmName = (id: number) => {
    const h = hukms.data?.find((x) => x.id === id)
    return h?.label ?? h?.arabic_name ?? h?.name ?? `#${id}`
  }

  return (
    <fieldset className={styles.filters}>
      <legend>{t('search.filters.heading')}</legend>

      <label className={styles.filterField}>
        <span>{t('search.filters.hukm')}</span>
        <select
          value={filters.hukm_id ?? ''}
          onChange={(e) => onChange({ ...filters, hukm_id: e.target.value ? Number(e.target.value) : undefined })}
        >
          <option value="">{t('search.filters.hukmAll')}</option>
          {(hukms.data ?? []).map((h) => (
            <option key={h.id} value={h.id}>
              {h.label ?? h.arabic_name ?? h.name}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.filterField}>
        <label htmlFor="narrator-filter">{t('search.filters.narrator')}</label>
        <input
          id="narrator-filter"
          value={filters.narrator_id ? (filters.narrator_label ?? `#${filters.narrator_id}`) : typed}
          readOnly={!!filters.narrator_id}
          placeholder={t('search.filters.narratorPlaceholder')}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
        />
        {term.length >= 2 && !filters.narrator_id ? (
          <ul className={styles.suggest} aria-label={t('search.filters.narrator')}>
            {narrators.isPending ? <li className={styles.hint}>{t('search.filters.narratorSearching')}</li> : null}
            {narrators.data?.length === 0 ? <li className={styles.hint}>{t('search.filters.narratorNone')}</li> : null}
            {narrators.data?.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    setTyped('')
                    onChange({ ...filters, narrator_id: n.id, narrator_label: n.name })
                  }}
                >
                  <BidiText>{n.name}</BidiText>
                  {n.deathdate ? <span className={styles.hint}> (d. {n.deathdate} AH)</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className={styles.filterField}>
        <span>{t('search.filters.book')}</span>
        <NeutralState kind="unknown">{t('search.filters.bookUnavailable')}</NeutralState>
      </div>

      {filters.hukm_id || filters.narrator_id ? (
        <div className={styles.chips} role="group" aria-label={t('search.filters.active')}>
          {filters.hukm_id ? (
            <button
              type="button"
              className={styles.chip}
              onClick={() => onChange({ ...filters, hukm_id: undefined })}
              aria-label={t('search.filters.remove', { label: hukmName(filters.hukm_id) })}
            >
              {t('search.filters.hukmChip', { name: hukmName(filters.hukm_id) })} ✕
            </button>
          ) : null}
          {filters.narrator_id ? (
            <button
              type="button"
              className={styles.chip}
              onClick={() => onChange({ ...filters, narrator_id: undefined, narrator_label: undefined })}
              aria-label={t('search.filters.remove', { label: filters.narrator_label ?? `#${filters.narrator_id}` })}
            >
              {t('search.filters.narratorChip', { name: filters.narrator_label ?? `#${filters.narrator_id}` })} ✕
            </button>
          ) : null}
        </div>
      ) : null}

      <p className={styles.hint}>{t('search.filters.coverage')}</p>
    </fieldset>
  )
}
