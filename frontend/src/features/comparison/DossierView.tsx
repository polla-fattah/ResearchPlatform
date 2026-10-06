import { useTranslation } from 'react-i18next'
import { BidiText } from '@/components/BidiText'
import {
  DEFAULT_CRITICISM,
  DEFAULT_IDENTITY,
  type CriticismRow,
  type IdentityRow,
} from './comparisonModel'
import styles from './Comparison.module.css'

interface DossierViewProps {
  narratorName?: string
  narratorCode?: string
  arabicName?: string
  identity?: IdentityRow[]
  criticism?: CriticismRow[]
  onGoCriticism: () => void
}

export function DossierView({
  narratorName = 'Abū Isḥāq al-Sabīʿī',
  narratorCode = 'NAR-000512',
  arabicName = 'عمرو بن عبد الله أبو إسحاق السبيعي',
  identity = DEFAULT_IDENTITY,
  criticism = DEFAULT_CRITICISM.slice(0, 3),
  onGoCriticism,
}: DossierViewProps) {
  const { t } = useTranslation()

  return (
    <div className={styles.dossierView}>
      <div className={styles.dossierHead}>
        <span className={styles.dossierKicker}>
          {t('comparison.dossier.kicker', { code: narratorCode })}
        </span>
        <h2 className={styles.dossierTitle}>{narratorName}</h2>
        <span className={styles.dossierArabic}>
          <BidiText>{arabicName}</BidiText>
        </span>
      </div>

      <div className={styles.dossierGrid}>
        <section className={styles.dossierSection}>
          <h3 className={styles.sectionHeading}>
            {t('comparison.dossier.identity')}
          </h3>
          <div className={styles.identityGrid}>
            {identity.map((item, idx) => (
              <div key={idx} style={{ display: 'contents' }}>
                <span className={styles.identityKey}>{item.k}</span>
                <span className={styles.identityVal}>
                  <span>{item.v}</span>
                  {item.flag ? (
                    <span className={styles.uncertainBadge}>{item.flag}</span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.dossierSection}>
          <h3 className={styles.sectionHeading}>
            {t('comparison.dossier.teachersStudents')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
            <span style={{ color: 'var(--muted)' }}>
              {t('comparison.dossier.teachersCount', { count: 38 })}
            </span>
            <span>
              al-Barāʾ ibn ʿĀzib · Zayd ibn Arqam · ʿAbd Khayr al-Hamdānī · Abū Ḥayya · +34
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
            <span style={{ color: 'var(--muted)' }}>
              {t('comparison.dossier.studentsCount', { count: 112 })}
            </span>
            <span>
              Shuʿba · Sufyān al-Thawrī · Isrāʾīl · Zuhayr ibn Muʿāwiya · +108
            </span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            {t('comparison.dossier.corpusListsNote')}
          </span>
        </section>
      </div>

      <section
        className={styles.dossierSection}
        style={{ flex: '1 1 100%' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <h3 className={styles.sectionHeading}>
            {t('comparison.dossier.attributedCriticism')}
          </h3>
          <button
            type="button"
            onClick={onGoCriticism}
            className={styles.annotateBtn}
          >
            {t('comparison.dossier.compareCriticism')}
          </button>
        </div>

        {criticism.map((c, idx) => (
          <div key={idx} className={styles.critShortCard}>
            <span className={styles.critShortKicker}>
              ⚖ {t('comparison.dossier.attributedTo', { critic: c.critic })}
            </span>
            <span className={styles.critShortQawl}>
              <BidiText>{c.qawl}</BidiText>
            </span>
            <span className={styles.critShortSrc}>{c.src}</span>
          </div>
        ))}
      </section>

      <section
        className={styles.dossierSection}
        style={{ flex: '1 1 100%', gap: '8px' }}
      >
        <h3 className={styles.sectionHeading}>
          {t('comparison.dossier.relatedReports')}
        </h3>
        <span style={{ fontSize: '13px', color: 'var(--ink-2)' }}>
          {t('comparison.dossier.relatedReportsBody', {
            chainsCount: 2,
            totalChains: 3,
            evidenceCount: 6,
            corpusCount: 412,
          })}
        </span>
      </section>
    </div>
  )
}
