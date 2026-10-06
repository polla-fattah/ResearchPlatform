import { useTranslation } from 'react-i18next'
import type { Submission } from '@/api/schemas/submission'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { formatCode } from '@/domain/codes'
import { completedReviews, shortChecksum } from './submissionModel'
import styles from './Submission.module.css'

/**
 * The packages submitted so far, newest first. Each is frozen: its status is its own, and an earlier package keeps the
 * outcome it got. An author sees the editor's decision and note; never who reviewed, and never what a reviewer wrote.
 */
export function PackageList({ items }: { items: readonly Submission[] }) {
  const { t } = useTranslation()
  const { date, n } = usePreferences()
  const rows = [...items].sort((a, b) => b.version_number - a.version_number)
  return (
    <table className={styles.table} aria-label={t('submission.packages.title')}>
      <thead>
        <tr>
          <th scope="col">{t('submission.packages.package')}</th>
          <th scope="col">{t('submission.packages.status')}</th>
          <th scope="col">{t('submission.packages.submitted')}</th>
          <th scope="col">{t('submission.packages.fingerprint')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => {
          const reviews = completedReviews(s)
          return (
            <tr key={s.id}>
              <th scope="row">
                <span className="mono">{formatCode('SUB', s.id)}</span> · {t('submission.packages.version', { version: n(s.version_number) })}
                <div>
                  <BidiText>{s.title}</BidiText>
                </div>
              </th>
              <td>
                {t(`submission.status.${s.status}`, { defaultValue: s.status })}
                {reviews > 0 ? <div className={styles.hint}>{t('submission.packages.reviews', { count: reviews, formattedCount: n(reviews) })}</div> : null}
                {s.decision?.decision_notes ? (
                  <p className={styles.letter}>
                    <strong>{t('submission.packages.editor')}</strong> <BidiText>{s.decision.decision_notes}</BidiText>
                  </p>
                ) : null}
                {s.author_response_notes ? (
                  <p className={styles.hint}>
                    {t('submission.packages.yourResponse')}: <BidiText>{s.author_response_notes}</BidiText>
                  </p>
                ) : null}
              </td>
              <td>{s.submitted_at ? date(s.submitted_at, { time: true }) : ''}</td>
              <td className={styles.mono}>{shortChecksum(s.package_checksum)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
