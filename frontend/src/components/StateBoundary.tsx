import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/api/errors'
import type { ViewState } from './viewState'
import { Button } from './Button'
import styles from './StateBoundary.module.css'

interface Props {
  state: ViewState
  children: ReactNode
  /** Overrides for the built-in panels. */
  empty?: ReactNode
  loading?: ReactNode
  error?: ReactNode
  forbidden?: ReactNode
  conflict?: ReactNode
  /** Shown on the error panel; keeps the user's input in place. */
  onRetry?: () => void
  /** For an error state: the underlying error, used to pick a friendlier message. */
  errorValue?: unknown
}

function Panel({
  title,
  body,
  tone,
  action,
}: {
  title: string
  body: string
  tone?: 'error' | 'conflict' | 'empty'
  action?: ReactNode
}) {
  return (
    <section
      className={[styles.panel, tone ? styles[tone] : ''].join(' ')}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.body}>{body}</p>
      {action}
    </section>
  )
}

export function StateBoundary({
  state,
  children,
  empty,
  loading,
  error,
  forbidden,
  conflict,
  onRetry,
  errorValue,
}: Props) {
  const { t } = useTranslation()

  switch (state) {
    case 'normal':
      return <>{children}</>
    case 'loading':
      return (
        loading ?? (
          <div className={styles.skeleton} role="status" aria-label={t('states.loading.label')}>
            {[0, 1, 2].map((i) => (
              <div key={i} className={styles.skeletonRow} />
            ))}
          </div>
        )
      )
    case 'empty':
      return empty ?? <Panel tone="empty" title={t('states.empty.title')} body={t('states.empty.body')} />
    case 'forbidden':
      return (
        forbidden ?? <Panel title={t('states.forbidden.title')} body={t('states.forbidden.body')} />
      )
    case 'conflict':
      return (
        conflict ?? (
          <Panel tone="conflict" title={t('states.conflict.title')} body={t('states.conflict.body')} />
        )
      )
    case 'error': {
      if (error) return <>{error}</>
      const offline = errorValue instanceof ApiError && errorValue.code === 'NETWORK'
      return (
        <Panel
          tone="error"
          title={t('states.error.title')}
          body={offline ? t('states.error.network') : t('states.error.body')}
          action={onRetry ? <Button onClick={onRetry}>{t('common.retry')}</Button> : undefined}
        />
      )
    }
  }
}
