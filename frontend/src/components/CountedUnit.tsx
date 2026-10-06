import { useTranslation } from 'react-i18next'
import { usePreferences } from '@/app/preferencesContext'

export type CountUnit =
  | 'occurrence'
  | 'report'
  | 'evidence'
  | 'resource'
  | 'finding'
  | 'document'
  | 'narrator'
  | 'item'

/** Counts always carry units ("42 occurrences"), and numbers follow the numerals preference. */
export function CountedUnit({ count, unit }: { count: number; unit: CountUnit }) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  return <>{t(`units.${unit}`, { count, formattedCount: n(count) })}</>
}
