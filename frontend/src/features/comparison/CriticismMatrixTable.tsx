import { useTranslation } from 'react-i18next'
import type { CriticismMatrixResult } from '@/api/schemas/analyses'
import { usePreferences } from '@/app/preferencesContext'
import { NeutralState } from '@/components/Badges'
import { BidiText } from '@/components/BidiText'
import { narratorCode } from './comparisonModel'
import styles from './Comparison.module.css'

/**
 * Who said something about whom. The server's matrix has one entry per critic and narrator, without the exact
 * wording and with no category for any statement ("Unspecified"), so a cell says that a statement is recorded and
 * leaves the wording to the list under it, which comes straight from the corpus (request file C-19).
 */
export function CriticismMatrixTable({ result }: { result: CriticismMatrixResult }) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const rows = Object.values(result.matrix)

  if (rows.length === 0 || result.scholars.length === 0) return <p className={styles.notice}>{t('comparison.crit.noMatrix')}</p>

  return (
    <table className={styles.table}>
      <caption className={styles.hint}>{t('comparison.crit.matrixNote')}</caption>
      <thead>
        <tr>
          <th scope="col">{t('comparison.crit.critic')}</th>
          {rows.map((r) => (
            <th key={r.narrator.id} scope="col">
              <BidiText>{r.narrator.name}</BidiText> <span className={styles.code}>{narratorCode(r.narrator.id)}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {result.scholars.map((s) => (
          <tr key={s.id}>
            <th scope="row">
              <BidiText>{s.name}</BidiText>
            </th>
            {rows.map((r) => {
              const e = r.evaluations[String(s.id)]
              return (
                <td key={r.narrator.id}>
                  {e ? (
                    e.hukm === 'Unspecified' ? (
                      <NeutralState kind="unknown">{t('comparison.crit.statement')}</NeutralState>
                    ) : (
                      <BidiText>{e.hukm}</BidiText>
                    )
                  ) : (
                    <span aria-label={t('comparison.crit.none')}>—</span>
                  )}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">{t('comparison.crit.statements')}</th>
          {rows.map((r) => (
            <td key={r.narrator.id} className={styles.cellNum}>
              {n(r.counts.total_statements)}
            </td>
          ))}
        </tr>
      </tfoot>
    </table>
  )
}
