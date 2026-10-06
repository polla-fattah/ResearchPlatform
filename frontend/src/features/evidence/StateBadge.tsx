import { useTranslation } from 'react-i18next'
import { NEUTRAL_EVIDENCE_STATES, type EvidenceState } from '@/domain/vocab'
import { stateOf } from './evidenceModel'
import styles from './Evidence.module.css'

/** State in words, never colour alone. Unresolved is dashed (unknown is not an error). */
export function StateBadge({ state }: { state: string }) {
  const { t } = useTranslation()
  const known = stateOf(state)
  const neutral = known !== null && NEUTRAL_EVIDENCE_STATES.includes(known as EvidenceState)
  return (
    <span className={[styles.stateBadge, neutral ? styles.stateNeutral : ''].join(' ')}>
      {known ? t(`evidenceState.${known}`) : state}
    </span>
  )
}
