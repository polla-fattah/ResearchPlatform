import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { searchCorpus } from '@/api/corpus'
import { listEvidence } from '@/api/evidence'
import { qk } from '@/api/queryKeys'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { evidenceCode, hadithIdOf } from '../evidence/evidenceModel'
import { MAX_REPORTS, MIN_REPORTS, reportCode } from './comparisonModel'
import styles from './Comparison.module.css'

interface Props {
  projectId: number
  /** The reports already chosen. */
  initial: number[]
  onApply: (ids: number[]) => void
  onClose: () => void
}

const excerpt = (s: string | null | undefined) => (s && s.length > 80 ? `${s.slice(0, 80).trimEnd()}…` : (s ?? ''))

/** Choose two to six reports to compare: from this project's evidence, or found in the corpus. */
export function SelectReportsDialog({ projectId, initial, onApply, onClose }: Props) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const [picked, setPicked] = useState<number[]>(initial)
  const [draft, setDraft] = useState('')
  const [term, setTerm] = useState('')

  const evidence = useQuery({
    queryKey: qk.project(projectId).evidence.list({ per_page: 100 }),
    queryFn: ({ signal }) => listEvidence(projectId, { per_page: 100 }, signal),
  })
  const found = useQuery({
    queryKey: qk.corpus.search({ q: term, per_page: 8 }),
    queryFn: ({ signal }) => searchCorpus({ q: term, per_page: 8 }, signal),
    enabled: term.length >= 2,
  })

  const fromEvidence = new Map<number, { code: string; title: string; text: string }>()
  for (const item of evidence.data?.items ?? []) {
    const id = hadithIdOf(item.resource)
    if (id !== null && !fromEvidence.has(id)) {
      fromEvidence.set(id, { code: evidenceCode(item.id), title: item.resource?.title ?? '', text: item.captured_text })
    }
  }

  const toggle = (id: number) =>
    setPicked((current) => (current.includes(id) ? current.filter((x) => x !== id) : current.length < MAX_REPORTS ? [...current, id] : current))
  const full = picked.length >= MAX_REPORTS

  const row = (id: number, label: string, text: string) => (
    <li key={id} className={styles.pick}>
      <input
        id={`pick-${id}`}
        type="checkbox"
        checked={picked.includes(id)}
        disabled={!picked.includes(id) && full}
        onChange={() => toggle(id)}
        aria-label={`${reportCode(id)} ${label}`}
      />
      <label htmlFor={`pick-${id}`}>
        <span className={styles.code}>
          {reportCode(id)} · {label}
        </span>
        <BidiText as="span">{excerpt(text)}</BidiText>
      </label>
    </li>
  )

  const search = (e: FormEvent) => {
    e.preventDefault()
    setTerm(draft.trim())
  }

  return (
    <Modal title={t('comparison.select.title')} onClose={onClose} wide>
      <div className={styles.dialogForm}>
        <p className={styles.hint}>{t('comparison.select.hint', { min: MIN_REPORTS, max: MAX_REPORTS })}</p>

        <section aria-label={t('comparison.select.fromEvidence')}>
          <h3>{t('comparison.select.fromEvidence')}</h3>
          {evidence.isPending ? <p role="status">{t('states.loading.label')}</p> : null}
          {evidence.isError ? <p role="alert">{t('comparison.select.evidenceFailed')}</p> : null}
          {evidence.data && fromEvidence.size === 0 ? <p className={styles.hint}>{t('comparison.select.noEvidence')}</p> : null}
          <ul className={styles.picks}>{[...fromEvidence].map(([id, e]) => row(id, e.code, e.text))}</ul>
        </section>

        <section aria-label={t('comparison.select.fromCorpus')}>
          <h3>{t('comparison.select.fromCorpus')}</h3>
          <form onSubmit={search} role="search" className={styles.barActions}>
            <input aria-label={t('comparison.select.search')} dir="auto" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <Button type="submit" disabled={draft.trim().length < 2}>
              {t('comparison.narrators.searchButton')}
            </Button>
          </form>
          {found.isPending && term.length >= 2 ? <p role="status">{t('states.loading.label')}</p> : null}
          {found.isError ? <p role="alert">{t('comparison.select.searchFailed')}</p> : null}
          {found.data && found.data.data.length === 0 ? <p className={styles.hint}>{t('comparison.select.noResults')}</p> : null}
          <ul className={styles.picks}>
            {(found.data?.data ?? []).map((hit) => row(hit.id, hit.occurrences?.[0]?.book?.title ?? hit.references?.[0]?.book?.title ?? '', hit.matn ?? ''))}
          </ul>
        </section>

        <p role="status">{t('comparison.select.count', { picked: n(picked.length), max: n(MAX_REPORTS) })}</p>
        <div className={styles.dialogActions}>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={picked.length < MIN_REPORTS} onClick={() => onApply(picked)}>
            {t('comparison.select.apply')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
