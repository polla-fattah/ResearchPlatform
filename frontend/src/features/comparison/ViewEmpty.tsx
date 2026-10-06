import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import type { View } from './comparisonModel'
import styles from './Comparison.module.css'

/** What a view says before it has anything to show, and the one thing to do about it. */
export function ViewEmpty({ view, canSelect, onSelect }: { view: View; canSelect: boolean; onSelect: () => void }) {
  const { t } = useTranslation()
  return (
    <div className={styles.empty}>
      <h2>{t(`comparison.empty.${view}.title`)}</h2>
      <p>{t(`comparison.empty.${view}.body`)}</p>
      {canSelect ? (
        <Button variant="primary" onClick={onSelect}>
          {t('comparison.bar.select')}
        </Button>
      ) : null}
    </div>
  )
}
