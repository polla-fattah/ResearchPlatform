import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { errorMessage } from '@/api/errorMessage'
import styles from './MutationNotice.module.css'

interface Props {
  /** `mutation.error` (or a query's). Nothing is shown while it is empty. */
  error: unknown
  /** What failed, in a few words: "The state wasn't changed". */
  title?: string
  /** Something the person can do about it (a retry button). */
  children?: ReactNode
}

/**
 * Shows why a write failed, straight from the mutation (state rule S6). There is no copy of the error in component
 * state: TanStack clears `mutation.error` when the action is tried again, and this disappears with it.
 */
export function MutationNotice({ error, title, children }: Props) {
  const { t } = useTranslation()
  if (!error) return null
  return (
    <div role="alert" className={styles.notice}>
      <p>
        {title ? <strong>{title}. </strong> : null}
        {errorMessage(error, t)}
      </p>
      {children}
    </div>
  )
}
