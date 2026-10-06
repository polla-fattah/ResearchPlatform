import type { ReactNode } from 'react'
import styles from './Admin.module.css'

/** Title and one line saying what the view holds, the same on every administration view. */
export function AdminHead({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className={styles.head}>
      <h1>{title}</h1>
      {subtitle ? <p className={styles.hint}>{subtitle}</p> : null}
      {children}
    </div>
  )
}

export interface ChipItem {
  value: string
  label: string
  /** How many are in it, when known. */
  count?: number | string
}

/** A row of choices with the current one pressed (a filter that lives in the address). */
export function FilterChips({ label, items, value, onChange }: { label: string; items: ChipItem[]; value: string; onChange: (value: string) => void }) {
  return (
    <ul className={styles.chips} aria-label={label}>
      {items.map((item) => (
        <li key={item.value}>
          <button type="button" className={styles.chip} aria-pressed={item.value === value} onClick={() => onChange(item.value)}>
            {item.label}
            {item.count !== undefined ? <span className={styles.chipCount}>{item.count}</span> : null}
          </button>
        </li>
      ))}
    </ul>
  )
}
