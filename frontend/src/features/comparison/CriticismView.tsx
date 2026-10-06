import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BidiText } from '@/components/BidiText'
import { DEFAULT_CRITICISM, type CriticismRow } from './comparisonModel'
import styles from './Comparison.module.css'

interface CriticismViewProps {
  criticismList?: CriticismRow[]
}

export function CriticismView({
  criticismList = DEFAULT_CRITICISM,
}: CriticismViewProps) {
  const { t } = useTranslation()

  const [criticFilter, setCriticFilter] = useState('all')
  const [expressionFilter, setExpressionFilter] = useState('any')
  const [bookFilter, setBookFilter] = useState('any')
  const [categoryFilter, setCategoryFilter] = useState('any')

  const filteredList = criticismList.filter((item) => {
    if (criticFilter !== 'all' && !item.critic.toLowerCase().includes(criticFilter.toLowerCase())) {
      return false
    }
    return true
  })

  return (
    <div className={styles.critView}>
      <div className={styles.critFiltersRow}>
        <label className={styles.critFilterLabel}>
          {t('comparison.crit.targetNarrator')}
          <select className={styles.critSelect} disabled>
            <option>Abū Isḥāq al-Sabīʿī</option>
          </select>
        </label>

        <label className={styles.critFilterLabel}>
          {t('comparison.crit.critic')}
          <select
            className={styles.critSelect}
            value={criticFilter}
            onChange={(e) => setCriticFilter(e.target.value)}
          >
            <option value="all">{t('comparison.crit.allCritics')}</option>
            <option value="Ibn Ḥajar">Ibn Ḥajar</option>
            <option value="al-ʿIjlī">al-ʿIjlī</option>
            <option value="Abū Ḥātim">Abū Ḥātim</option>
            <option value="Ibn Maʿīn">Ibn Maʿīn</option>
          </select>
        </label>

        <label className={styles.critFilterLabel}>
          {t('comparison.crit.expression')}
          <select
            className={styles.critSelect}
            value={expressionFilter}
            onChange={(e) => setExpressionFilter(e.target.value)}
          >
            <option value="any">{t('comparison.crit.any')}</option>
            <option value="thiqah">Thiqah</option>
            <option value="tadlis">Tadlīs</option>
          </select>
        </label>

        <label className={styles.critFilterLabel}>
          {t('comparison.crit.book')}
          <select
            className={styles.critSelect}
            value={bookFilter}
            onChange={(e) => setBookFilter(e.target.value)}
          >
            <option value="any">{t('comparison.crit.any')}</option>
            <option value="taqrib">Taqrīb al-Tahdhīb</option>
            <option value="thiqat">al-Thiqāt</option>
            <option value="jarh">al-Jarḥ wa-l-taʿdīl</option>
          </select>
        </label>

        <label className={styles.critFilterLabel}>
          {t('comparison.crit.category')}
          <select
            className={styles.critSelect}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="any">{t('comparison.crit.any')}</option>
            <option value="reliable">Reliable</option>
            <option value="weak">Weak</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
      </div>

      <div className={styles.critNote}>
        {t('comparison.crit.note')}
      </div>

      <div
        role="region"
        aria-label="Criticism comparison table, scrolls horizontally"
        tabIndex={0}
        className={styles.critTableRegion}
      >
        <div className={styles.critTableInner}>
          <div className={styles.critTableHeader}>
            <span>{t('comparison.crit.thCritic')}</span>
            <span>{t('comparison.crit.thQawl')}</span>
            <span>{t('comparison.crit.thSource')}</span>
            <span>{t('comparison.crit.thLabel')}</span>
          </div>

          {filteredList.map((c, idx) => (
            <div key={idx} className={styles.critTableRow}>
              <div className={styles.critCriticCol}>
                <span className={styles.critCriticName}>{c.critic}</span>
                <span className={styles.critCriticDied}>{c.died}</span>
              </div>

              <div className={styles.critQawlCol}>
                <span className={styles.critAttributedKicker}>
                  ⚖ {t('comparison.crit.attributed')}
                </span>
                <span className={styles.critQawlText}>
                  <BidiText>{c.qawl}</BidiText>
                </span>
              </div>

              <div className={styles.critSrcCol}>
                <span>{c.src}</span>
              </div>

              <div>
                <span
                  className={[
                    styles.critLabelBadge,
                    c.dashed ? styles.critLabelBadgeDashed : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {c.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
