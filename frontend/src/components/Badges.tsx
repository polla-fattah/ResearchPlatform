import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Visibility } from '@/domain/vocab'
import styles from './Badges.module.css'

/** Provenance is always text + icon, never colour alone (conventions §1). */
export type ProvenanceKind = 'source' | 'note' | 'attributed' | 'suggestion'

const PROVENANCE_ICON: Record<ProvenanceKind, string> = {
  source: '❝',
  note: '✎',
  attributed: '⚖',
  suggestion: '◇',
}

export function ProvenanceTag({ kind, name }: { kind: ProvenanceKind; name?: string }) {
  const { t } = useTranslation()
  const label =
    kind === 'attributed'
      ? name
        ? t('provenance.attributed', { name })
        : t('provenance.attributedUnnamed')
      : t(`provenance.${kind}`)
  return (
    <span className={[styles.badge, styles[kind]].join(' ')}>
      <span aria-hidden="true">{PROVENANCE_ICON[kind]}</span>
      {label}
    </span>
  )
}

const VISIBILITY_ICON: Record<Visibility, string> = {
  private: '🔒',
  project: '◫',
  announcement: '◉',
  publication: '◉',
}

export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  const { t } = useTranslation()
  const isPublic = visibility === 'announcement' || visibility === 'publication'
  return (
    <span className={[styles.badge, styles.mono, isPublic ? styles.public : ''].join(' ')}>
      <span aria-hidden="true">{VISIBILITY_ICON[visibility]}</span>
      {t(`visibility.${visibility}`)}
    </span>
  )
}

export type NeutralKind =
  | 'unknown'
  | 'unresolved'
  | 'incompleteCitation'
  | 'partialRun'
  | 'uncertainOrder'
  | 'limitation'

/** Dashed, never red: unknown or incomplete is not an error. */
export function NeutralState({ kind, children }: { kind: NeutralKind; children?: ReactNode }) {
  const { t } = useTranslation()
  return (
    <span className={[styles.badge, styles.neutral].join(' ')}>
      {children ?? t(`neutral.${kind}`)}
    </span>
  )
}
