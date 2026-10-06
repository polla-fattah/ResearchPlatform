import { useTranslation } from 'react-i18next'
import { NeutralState } from './Badges'
import { BidiText } from './BidiText'
import styles from './StoredValue.module.css'

const MAX_ITEMS = 50
const MAX_DEPTH = 6

const isScalar = (v: unknown): v is string | number | boolean => ['string', 'number', 'boolean'].includes(typeof v)
const label = (key: string) => key.replace(/_/g, ' ')

/**
 * A stored value shown exactly as stored: names with their values, lists as lists. Nothing is interpreted, summed or
 * relabelled, so a result stored in some other shape is never presented as something the server computed, and the
 * details of an audit entry are shown as they were recorded.
 */
export function StoredValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const { t } = useTranslation()

  if (value === null || value === undefined || value === '') return <NeutralState kind="unknown">{t('common.stored.empty')}</NeutralState>
  if (typeof value === 'string') return <BidiText>{value}</BidiText>
  if (isScalar(value)) return <>{String(value)}</>
  if (depth >= MAX_DEPTH) return <code>{JSON.stringify(value).slice(0, 200)}</code>

  if (Array.isArray(value)) {
    if (value.length === 0) return <NeutralState kind="unknown">{t('common.stored.empty')}</NeutralState>
    const items = value.slice(0, MAX_ITEMS)
    const more = value.length - items.length
    if (items.every(isScalar)) {
      return (
        <>
          {items.map((item, i) => (
            <span key={i}>
              {i > 0 ? ' · ' : ''}
              <StoredValue value={item} depth={depth + 1} />
            </span>
          ))}
          {more > 0 ? ` · ${t('common.stored.more', { count: more })}` : ''}
        </>
      )
    }
    return (
      <ul className={styles.stored}>
        {items.map((item, i) => (
          <li key={i}>
            <StoredValue value={item} depth={depth + 1} />
          </li>
        ))}
        {more > 0 ? <li>{t('common.stored.more', { count: more })}</li> : null}
      </ul>
    )
  }

  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length === 0) return <NeutralState kind="unknown">{t('common.stored.empty')}</NeutralState>
  return (
    <dl className={styles.stored}>
      {entries.slice(0, MAX_ITEMS).map(([key, v]) => (
        <div key={key} className={styles.entry}>
          <dt>{label(key)}</dt>
          <dd>
            <StoredValue value={v} depth={depth + 1} />
          </dd>
        </div>
      ))}
    </dl>
  )
}
