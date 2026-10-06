import { useTranslation } from 'react-i18next'
import styles from './FindingEditor.module.css'

interface Props {
  isOpen: boolean
  isMemberConflict?: boolean
  onClose: () => void
  onKeepExisting: () => void
  onSaveAsNewHead: () => void
  onMergeByHand: () => void
}

export function ConflictModal({
  isOpen,
  isMemberConflict = false,
  onClose,
  onKeepExisting,
  onSaveAsNewHead,
  onMergeByHand,
}: Props) {
  const { t } = useTranslation()

  if (!isOpen) return null

  return (
    <div
      className={styles.modalBackdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="conflict-dialog-title"
        className={styles.modalDialog}
        style={{ maxWidth: '900px' }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)',
            fontSize: '11px',
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            color: '#6a6257',
          }}
        >
          {isMemberConflict
            ? t('findingsEditor.conflict.col06Label', {
                defaultValue: 'COL-06 · Main article §2 · your save was stopped',
              })
            : t('findingsEditor.conflict.sessionLabel', {
                defaultValue: 'Main article · save rejected',
              })}
        </div>

        <h2 id="conflict-dialog-title" className={styles.modalTitle}>
          {isMemberConflict
            ? t('findingsEditor.conflict.memberTitle', {
                defaultValue: 'Aras Kamal changed this paragraph while you were editing',
              })
            : t('findingsEditor.conflict.sessionTitle', {
                defaultValue: 'This document changed in another session',
              })}
        </h2>

        <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: '#4a443b' }}>
          {isMemberConflict
            ? t('findingsEditor.conflict.memberDesc', {
                defaultValue:
                  'Aras saved v16 at 11:51. Your changes were based on v15, so they weren’t saved over his. Both versions are kept with their authors. Choose how to continue.',
              })
            : t('findingsEditor.conflict.sessionDesc', {
                defaultValue:
                  'You saved v15 from your laptop at 11:38. This tab was still on v14, so its save was stopped to avoid overwriting. Nothing is lost: both versions are below.',
              })}
        </p>

        <div className={styles.conflictCardsContainer}>
          {/* Card 1: Remote / other revision */}
          <div className={styles.conflictCardOther}>
            <div
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid #e3dbcb',
                fontSize: '13px',
                fontWeight: 600,
                background: '#fbf8f1',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <span>
                {isMemberConflict
                  ? 'v16 · Aras Kamal · 11:51'
                  : 'Saved v15 · other session · 11:38'}
              </span>
              {isMemberConflict ? (
                <span
                  style={{
                    fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)',
                    fontSize: '10px',
                    letterSpacing: '.06em',
                    textTransform: 'uppercase',
                    color: '#2f4e7a',
                  }}
                >
                  Researcher
                </span>
              ) : null}
            </div>
            <p style={{ margin: 0, padding: '12px', fontSize: '14px', lineHeight: 1.65 }}>
              Of 14 occurrences, 11 carry only the “three times” wording.{' '}
              <ins
                style={{
                  background: '#e8edf5',
                  textDecoration: 'none',
                  borderBottom: '2px solid #2f4e7a',
                }}
              >
                The 3 expanded forms all pass through Wakīʿ, whose teacher Sufyān is unresolved.
              </ins>
            </p>
          </div>

          {/* Card 2: Local unsaved text */}
          <div className={styles.conflictCardMine}>
            <div
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid #1f5a57',
                fontSize: '13px',
                fontWeight: 600,
                background: '#e3eeec',
                color: '#123b39',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <span>
                {isMemberConflict
                  ? 'Your unsaved text · Shilan Rashid'
                  : 'Your unsaved text · this tab'}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)',
                  fontSize: '10px',
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                }}
              >
                Owner
              </span>
            </div>
            <p style={{ margin: 0, padding: '12px', fontSize: '14px', lineHeight: 1.65 }}>
              Of 14 occurrences, 11 carry only the “three times” wording;{' '}
              <ins
                style={{
                  background: '#e3eeec',
                  textDecoration: 'none',
                  borderBottom: '2px solid #1f5a57',
                }}
              >
                the expansion appears only on the Wakīʿ route [@EV-0007].
              </ins>
            </p>
          </div>
        </div>

        <div className={styles.restoreNotice}>
          {t('findingsEditor.conflict.colNotice', {
            defaultValue:
              'There’s no real-time co-editing in R1. Whatever you choose, nobody’s text is thrown away, and every version keeps its author in the history.',
          })}
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button onClick={onKeepExisting} className={styles.actionButton}>
            {isMemberConflict
              ? t('findingsEditor.conflict.keepMember', { defaultValue: 'Keep Aras’s version' })
              : t('findingsEditor.conflict.copyAndOpen', { defaultValue: 'Copy my text and open v15' })}
          </button>
          <button onClick={onMergeByHand} className={styles.actionButton}>
            {isMemberConflict
              ? t('findingsEditor.conflict.mergeByHand', { defaultValue: 'Merge by hand' })
              : t('findingsEditor.conflict.compareDetail', { defaultValue: 'Compare in detail' })}
          </button>
          <button onClick={onSaveAsNewHead} className={styles.primaryActionButton}>
            {isMemberConflict
              ? t('findingsEditor.conflict.saveMineV17', { defaultValue: 'Save mine as v17' })
              : t('findingsEditor.conflict.saveMineV16', { defaultValue: 'Save mine as v16' })}
          </button>
        </div>
      </div>
    </div>
  )
}
