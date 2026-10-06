import { useTranslation } from 'react-i18next'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import type { NarratorRow } from './isnadModel'
import styles from './Isnad.module.css'

interface Props {
  rows: readonly NarratorRow[]
  selected: string | null
  onSelect: (id: string) => void
}

/**
 * Every narrator of the graph with the same facts the graph carries, as a table: the accessible way to read it, and the
 * one a keyboard or a screen reader uses. Choosing a row chooses the narrator in the graph too.
 */
export function NarratorTable({ rows, selected, onSelect }: Props) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  return (
    <table className={styles.table} aria-label={t('isnad.table.label')}>
      <thead>
        <tr>
          <th scope="col">{t('isnad.table.narrator')}</th>
          <th scope="col">{t('isnad.table.role')}</th>
          <th scope="col">{t('isnad.table.chains')}</th>
          <th scope="col">{t('isnad.table.teachers')}</th>
          <th scope="col">{t('isnad.table.students')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className={styles.row} aria-selected={r.id === selected}>
            <th scope="row">
              <button type="button" className={styles.link} aria-pressed={r.id === selected} onClick={() => onSelect(r.id)}>
                <BidiText>{r.name}</BidiText>
              </button>
            </th>
            <td>{t(`isnad.roles.${r.role}`)}</td>
            <td>{n(r.chains)}</td>
            <td>{r.teachers.length > 0 ? r.teachers.map((x) => x.name).join(' · ') : <span className={styles.hint}>{t('isnad.table.none')}</span>}</td>
            <td>{r.students.length > 0 ? r.students.map((x) => x.name).join(' · ') : <span className={styles.hint}>{t('isnad.table.none')}</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
