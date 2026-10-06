import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BidiText } from '@/components/BidiText'
import { type VersionInfo } from './editorModel'
import styles from './FindingEditor.module.css'

interface Props {
  documentTitle: string
  versions: VersionInfo[]
  onBackToEditor: () => void
  onRestoreVersion: (targetVersionNumber: number) => void
}

export function VersionsView({
  documentTitle,
  versions,
  onBackToEditor,
  onRestoreVersion,
}: Props) {
  const { t } = useTranslation()
  const [selectedVersionNum, setSelectedVersionNum] = useState<number>(12)
  const currentVersion = versions.find((v) => v.isCurrent) ?? versions[0]!
  const nextRestoredVersionNum = (currentVersion.versionNumber ?? 15) + 1

  return (
    <div className={styles.versionsLayout}>
      {/* Left Column: Version list */}
      <section
        style={{
          flex: '1 1 260px',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <button onClick={onBackToEditor} className={styles.breadcrumbLink}>
          {t('findingsEditor.versions.backToDoc', {
            title: documentTitle,
            defaultValue: `← Back to ${documentTitle}`,
          })}
        </button>
        <h1
          style={{
            fontFamily: 'var(--font-serif, "Newsreader", serif)',
            fontWeight: 500,
            fontSize: '26px',
            margin: 0,
          }}
        >
          {t('findingsEditor.versions.heading', { defaultValue: 'Version history' })}
        </h1>
        <div style={{ background: '#FFFDF8', border: '1px solid #E3DBCB' }}>
          {versions.map((v) => {
            const isSel = v.versionNumber === selectedVersionNum
            const isCur = v.isCurrent
            const borderRule = isCur ? '#1F5A57' : isSel ? '#7A5413' : 'transparent'
            const bg = isSel ? '#F5ECD9' : '#FFFDF8'

            return (
              <div
                key={v.id}
                onClick={() => setSelectedVersionNum(v.versionNumber)}
                className={styles.versionRow}
                style={{
                  borderLeft: `3px solid ${borderRule}`,
                  background: bg,
                }}
              >
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)', fontSize: '12px', fontWeight: 500 }}>
                    {v.id}
                  </span>
                  <span style={{ fontSize: '12px', color: '#6A6257' }}>{v.when}</span>
                </span>
                <span style={{ fontSize: '12px', color: '#4A443B' }}>{v.note}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Right Column: Diff comparison */}
      <section
        style={{
          flex: '2 1 420px',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '15px', fontWeight: 600 }}>
            {t('findingsEditor.versions.comparingHeading', {
              from: `v${selectedVersionNum}`,
              to: `v${currentVersion.versionNumber} (current)`,
              defaultValue: `Comparing v${selectedVersionNum} → v${currentVersion.versionNumber} (current)`,
            })}
          </span>
          <button
            onClick={() => onRestoreVersion(selectedVersionNum)}
            className={styles.primaryActionButton}
          >
            {t('findingsEditor.versions.restoreAction', {
              from: `v${selectedVersionNum}`,
              as: `v${nextRestoredVersionNum}`,
              defaultValue: `Restore v${selectedVersionNum} as v${nextRestoredVersionNum}`,
            })}
          </button>
        </div>

        {/* Diff Content Box */}
        <div className={styles.diffBox}>
          <p style={{ margin: 0 }}>
            Of 14 occurrences, <del className={styles.delDiff}>10</del>{' '}
            <ins className={styles.insDiff}>11</ins> carry only the “three times” wording.
          </p>
          <p style={{ margin: 0 }}>
            <ins className={styles.insDiff}>
              The identity of Sufyān on the Wakīʿ route is unresolved, which limits this conclusion.
            </ins>
          </p>
          <p
            dir="rtl"
            lang="ckb"
            style={{
              margin: 0,
              fontFamily: 'var(--font-arabic, "Noto Naskh Arabic", serif)',
              fontSize: '17px',
              textAlign: 'right',
            }}
          >
            <del className={styles.delDiff}>
              <BidiText as="span">ئەم دەربڕینە کۆنترە.</BidiText>
            </del>
          </p>
        </div>

        {/* Informational Safety Note */}
        <div className={styles.restoreNotice}>
          {t('findingsEditor.versions.restoreNotice', {
            from: `v${selectedVersionNum}`,
            as: `v${nextRestoredVersionNum}`,
            defaultValue: `Restoring never deletes later history. v${selectedVersionNum}'s text becomes a new v${nextRestoredVersionNum}, and later versions stay listed with their authors.`,
          })}
        </div>
      </section>
    </div>
  )
}
