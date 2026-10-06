import { useTranslation } from 'react-i18next'
import { Button } from './Button'
import styles from './MutationNotice.module.css'

interface Props {
  /** A query result: the notice shows when a refresh failed but the earlier answer is still there. */
  query: { isError: boolean; data: unknown; refetch: () => unknown }
  /** What could not be refreshed, e.g. "The discussions". */
  what: string
}

/**
 * The list on screen is the last one that loaded (state rule S1: the query keeps it, nothing is copied). This says the
 * latest refresh failed, so nobody mistakes it for current, and offers to try again.
 */
export function RefreshNotice({ query, what }: Props) {
  const { t } = useTranslation()
  if (!query.isError || query.data === undefined) return null
  return (
    <div role="alert" className={styles.notice}>
      <p>{t('common.refreshFailed', { what })}</p>
      <Button onClick={() => void query.refetch()}>{t('common.retry')}</Button>
    </div>
  )
}
