import { useTranslation } from 'react-i18next'
import type { Pagination as PaginationMeta } from '@/api/http'
import { usePreferences } from '@/app/preferencesContext'
import { Button } from './Button'
import styles from './Pagination.module.css'

interface Props {
  pagination: PaginationMeta
  onPage: (page: number) => void
}

export function Pagination({ pagination, onPage }: Props) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const { current_page: page, total_pages: total } = pagination
  if (total <= 1) return null
  return (
    <nav className={styles.nav} aria-label={t('common.pageOf', { page, total })}>
      <Button onClick={() => onPage(page - 1)} disabled={page <= 1}>
        {t('common.previous')}
      </Button>
      <span>{t('common.pageOf', { page: n(page), total: n(total) })}</span>
      <Button onClick={() => onPage(page + 1)} disabled={!pagination.has_more}>
        {t('common.next')}
      </Button>
    </nav>
  )
}
