import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './Registration.module.css'

/** 0 apply · 1 verify email · 2 administrator review · 4 access enabled (same numbering as the mockup). */
export type AccessStep = 0 | 1 | 2 | 4
export type ReviewOutcome = 'review' | 'info' | 'rejected'

interface Props {
  step: AccessStep
  /** Changes the third step's wording, as in the mockup. */
  review?: ReviewOutcome
  children: ReactNode
}

/** Card on the left, "How access works" on the right. */
export function RegistrationPage({ step, review = 'review', children }: Props) {
  return (
    <main className={styles.main}>
      <div className={styles.card}>{children}</div>
      <AccessSteps step={step} review={review} />
    </main>
  )
}

function AccessSteps({ step, review }: { step: AccessStep; review: ReviewOutcome }) {
  const { t } = useTranslation()
  const items = [
    { label: t('registration.steps.apply'), sub: t('registration.steps.applySub') },
    { label: t('registration.steps.verify'), sub: t('registration.steps.verifySub') },
    {
      label: t(`registration.steps.${review}`),
      sub: t(`registration.steps.${review}Sub`),
    },
    { label: t('registration.steps.enabled'), sub: t('registration.steps.enabledSub') },
  ]
  return (
    <aside className={styles.aside} aria-label={t('registration.steps.title')}>
      <h2>{t('registration.steps.title')}</h2>
      <ol className={styles.steps}>
        {items.map((item, i) => {
          const done = i < step
          const current = i === step
          return (
            <li
              key={item.label}
              className={[styles.step, done ? styles.stepDone : '', current ? styles.stepCurrent : '']
                .filter(Boolean)
                .join(' ')}
              aria-current={current ? 'step' : undefined}
            >
              <span className={styles.stepMark} aria-hidden="true">
                {done ? '✓' : current ? '●' : '○'}
              </span>
              <span>
                {item.label}
                <span className={styles.stepSub}>{item.sub}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </aside>
  )
}
