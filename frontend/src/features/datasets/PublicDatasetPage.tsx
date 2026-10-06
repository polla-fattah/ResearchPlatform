import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import styles from '@/features/publicAnnouncements/Public.module.css'

/**
 * Screen 39. Public dataset and dossier pages need datasets that can be released; the server has none (request file
 * API-15 and C-44), so every address under /datasets is the same plain "nothing is published here" page. It does not
 * pretend a dataset exists and does not look one up: there is nothing to look up.
 */
export function PublicDatasetPage() {
  const { t } = useTranslation()
  return (
    <div className={styles.page}>
      <div className={styles.empty}>
        <h1>{t('datasets.public.title')}</h1>
        <p>{t('datasets.public.body')}</p>
        <p>
          <Link to="/research">{t('datasets.public.research')}</Link>
        </p>
      </div>
    </div>
  )
}
