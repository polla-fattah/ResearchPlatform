import { useTranslation } from 'react-i18next'
import type { SavedQuery } from '@/api/schemas/search'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { queryCode } from './searchModel'
import styles from './Search.module.css'

interface Props {
  queries: SavedQuery[]
  openId: number | undefined
  canEdit: boolean
  busyId: number | undefined
  onOpen: (q: SavedQuery) => void
  onRun: (q: SavedQuery) => void
  onHistory: (q: SavedQuery) => void
  onDelete: (q: SavedQuery) => void
}

export function SavedQueries({ queries, openId, canEdit, busyId, onOpen, onRun, onHistory, onDelete }: Props) {
  const { t } = useTranslation()
  const { relative } = usePreferences()

  if (queries.length === 0) {
    return (
      <div className={styles.savedEmpty}>
        <strong>{t('search.saved.noneTitle')}</strong>
        <p>{t('search.saved.noneBody')}</p>
      </div>
    )
  }

  return (
    <ul className={styles.saved}>
      {queries.map((q) => {
        const last = [...(q.search_runs ?? [])].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0]
        return (
          <li key={q.id} className={[styles.savedItem, q.id === openId ? styles.savedOpen : ''].join(' ')}>
            <div className={styles.savedHead}>
              <span className="mono">{queryCode(q.id)}</span>
              <span className={styles.hint}>{t(`search.form.modes.${q.search_mode === 'exact' ? 'exact' : 'normalized'}`)}</span>
            </div>
            <strong>
              <BidiText>{q.name}</BidiText>
            </strong>
            <BidiText as="div" className={styles.savedText}>
              {q.query_text}
            </BidiText>
            <div className={styles.hint}>
              {last?.created_at ? t('search.saved.lastRun', { when: relative(last.created_at) }) : t('search.saved.neverRun')}
            </div>
            <div className={styles.savedActions}>
              <Button onClick={() => onOpen(q)} aria-label={`${t('search.saved.open')} ${q.name}`}>
                {t('search.saved.open')}
              </Button>
              {canEdit ? (
                <Button onClick={() => onRun(q)} disabled={busyId === q.id} aria-label={`${t('search.saved.rerun')} ${q.name}`}>
                  {t('search.saved.rerun')}
                </Button>
              ) : null}
              <Button variant="ghost" onClick={() => onHistory(q)} aria-label={`${t('search.saved.history')} ${q.name}`}>
                {t('search.saved.history')}
              </Button>
              {canEdit ? (
                <Button variant="ghost" onClick={() => onDelete(q)} aria-label={`${t('search.saved.delete')} ${q.name}`}>
                  {t('search.saved.delete')}
                </Button>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
