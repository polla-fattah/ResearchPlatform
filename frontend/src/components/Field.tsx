import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './Field.module.css'

interface FieldProps {
  label: string
  /** Shows "Required" or "Optional" next to the label, as in the mockups. */
  requirement?: 'required' | 'optional'
  hint?: ReactNode
  error?: string
  children: ReactNode
}

/** Label + control + hint + error, matching the design's form fields. */
export function Field({ label, requirement, hint, error, children }: FieldProps) {
  const { t } = useTranslation()
  return (
    <label className={styles.field}>
      <span className={styles.label}>
        {label}
        {requirement ? (
          <span className={[styles.tag, requirement === 'required' ? styles.required : ''].join(' ')}>
            {t(`common.${requirement}`)}
          </span>
        ) : null}
      </span>
      {children}
      {error ? (
        // Messages are written to read after "Label:" in the summary; inline they start a sentence.
        <span className={styles.error}>{error.charAt(0).toUpperCase() + error.slice(1)}</span>
      ) : null}
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </label>
  )
}

interface SummaryProps {
  title: string
  /** One line per problem, e.g. "Email: enter a full address". */
  items?: string[]
  footer?: string
}

/** The "Fix 2 fields to continue" banner. Input is always kept. */
export function ErrorSummary({ title, items = [], footer }: SummaryProps) {
  return (
    <div role="alert" className={styles.summary}>
      <div className={styles.summaryTitle}>{title}</div>
      {items.length > 0 ? (
        <div>
          {items.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      ) : null}
      {footer ? <div>{footer}</div> : null}
    </div>
  )
}

/** Neutral information box. `dashed` is for unknown/unavailable states (never red). */
export function Notice({ children, dashed }: { children: ReactNode; dashed?: boolean }) {
  return (
    <div role="status" className={[styles.notice, dashed ? styles.noticeDashed : ''].join(' ')}>
      {children}
    </div>
  )
}
