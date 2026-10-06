import { useTranslation } from 'react-i18next'
import {
  type MockDocument,
  type MockFinding,
} from './editorModel'
import styles from './FindingEditor.module.css'

interface Props {
  documents: MockDocument[]
  findings: MockFinding[]
  isEmpty?: boolean
  isLoading?: boolean
  onSelectDoc: (doc: MockDocument) => void
  onSelectFinding: (finding: MockFinding) => void
  onNewDoc: () => void
  onNewFinding: () => void
}

export function FindingsIndexView({
  documents,
  findings,
  isEmpty = false,
  isLoading = false,
  onSelectDoc,
  onSelectFinding,
  onNewDoc,
  onNewFinding,
}: Props) {
  const { t } = useTranslation()

  const summaryCount = isEmpty
    ? t('findingsEditor.index.noneYet', { defaultValue: 'None yet' })
    : t('findingsEditor.index.summaryCount', {
        docs: documents.length,
        findings: findings.length,
        links: 9,
        defaultValue: `${documents.length} documents · ${findings.length} findings · 9 links between them`,
      })

  return (
    <div className={styles.indexContainer}>
      <div className={styles.indexHeader}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h1 className={styles.indexTitle}>
            {t('findingsEditor.index.heading', { defaultValue: 'Findings and documents' })}
          </h1>
          <span className={styles.indexSubtitle}>{summaryCount}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
          <button onClick={onNewFinding} className={styles.actionButton}>
            {t('findingsEditor.index.newFinding', { defaultValue: 'New finding' })}
          </button>
          <button onClick={onNewDoc} className={styles.primaryActionButton}>
            {t('findingsEditor.index.newDoc', { defaultValue: 'New document' })}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div
          aria-busy="true"
          className={styles.skeletonPulse}
          style={{ height: '280px', borderRadius: '2px' }}
        />
      ) : isEmpty ? (
        <div
          style={{
            background: '#FFFDF8',
            border: '1px solid #E3DBCB',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            maxWidth: '680px',
          }}
        >
          <h2 style={{ fontFamily: 'var(--font-serif, "Newsreader", serif)', fontWeight: 500, fontSize: '22px', margin: 0 }}>
            {t('findingsEditor.index.emptyHeading', { defaultValue: 'Nothing written yet' })}
          </h2>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: '#4A443B' }}>
            {t('findingsEditor.index.emptyBody', {
              defaultValue:
                'A finding is one claim with its reasoning and evidence. It can be provisional or inconclusive. A document is a piece of writing, such as an article or chain summary, that can draw on several findings. One finding can appear in several documents.',
            })}
          </p>
        </div>
      ) : (
        <div className={styles.indexColumns}>
          {/* Documents Section */}
          <section
            style={{
              flex: '1 1 300px',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
              {t('findingsEditor.index.docsHeading', { count: documents.length, defaultValue: `Documents · ${documents.length}` })}
            </h2>
            {documents.map((d) => (
              <button
                key={d.id}
                onClick={() => onSelectDoc(d)}
                className={styles.docCard}
              >
                <span className={styles.docCardTitle}>{d.title}</span>
                <span className={styles.docCardMeta}>{d.meta}</span>
                <span className={styles.docCardLinks}>{d.links}</span>
              </button>
            ))}
          </section>

          {/* Findings Section */}
          <section
            style={{
              flex: '1.4 1 360px',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
              {t('findingsEditor.index.findingsHeading', { count: findings.length, defaultValue: `Findings · ${findings.length}` })}
            </h2>
            <div style={{ background: '#FFFDF8', border: '1px solid #E3DBCB' }}>
              {findings.map((f) => (
                <button
                  key={f.id}
                  onClick={() => onSelectFinding(f)}
                  className={styles.findingRow}
                >
                  <span style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: '1 1 260px' }}>
                    <span className={styles.findingRowTitle}>{f.title}</span>
                    <span className={styles.findingRowMeta}>{f.meta}</span>
                  </span>
                  <span
                    className={styles.findingStatusBadge}
                    style={{
                      border: `1px ${f.bs} #4A443B`,
                    }}
                  >
                    {f.status}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
