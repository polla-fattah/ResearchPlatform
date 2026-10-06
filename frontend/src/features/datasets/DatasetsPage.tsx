import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useProject } from '@/features/projects/useProject'
import styles from './Datasets.module.css'

/**
 * Screen 33. The dataset builder (a frozen, versioned table of records chosen by rules, with a data dictionary and a
 * redistribution check) has no server behind it: there are no dataset routes, tables or controllers (checked on 7 Oct
 * 2026, request file API-15 and C-44). The page says so and points to what exists, and draws no builder, no rules and no
 * example data: a builder that cannot save would only look like work being kept.
 */
export function DatasetsPage() {
  const { t } = useTranslation()
  const { id } = useProject()
  if (id === null) return null
  const base = `/projects/${id}`
  return (
    <section aria-label={t('datasets.title')}>
      <h1>{t('datasets.title')}</h1>
      <div className={styles.empty}>
        <h2>{t('datasets.unavailable.title')}</h2>
        <p>{t('datasets.unavailable.body')}</p>
        <h3>{t('datasets.meanwhile.title')}</h3>
        <ul className={styles.alts}>
          <li>
            <Link to={`${base}/searches`}>{t('datasets.meanwhile.sets')}</Link> {t('datasets.meanwhile.setsText')}
          </li>
          <li>
            <Link to="/downloads">{t('datasets.meanwhile.zip')}</Link> {t('datasets.meanwhile.zipText')}
          </li>
        </ul>
      </div>
    </section>
  )
}
