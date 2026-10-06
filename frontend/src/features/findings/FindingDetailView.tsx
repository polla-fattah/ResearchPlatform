import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { type FindingStatus } from '@/api/schemas/findings'
import {
  checkSubmissionReadiness,
  type MockFinding,
} from './editorModel'
import styles from './FindingEditor.module.css'

interface Props {
  finding: MockFinding
  projectId: number
  onBackToIndex: () => void
  onOpenDoc: (docTitle: string) => void
  onUpdateFinding?: (updated: MockFinding) => void
}

export function FindingDetailView({
  finding: initialFinding,
  projectId,
  onBackToIndex,
  onOpenDoc,
  onUpdateFinding,
}: Props) {
  const { t } = useTranslation()
  const [finding, setFinding] = useState<MockFinding>(initialFinding)
  const [saveStatus, setSaveStatus] = useState<string>('Saved 11:42')

  const readiness = checkSubmissionReadiness(finding)

  const handleFieldChange = (field: keyof MockFinding, value: unknown) => {
    const updated = { ...finding, [field]: value }
    setFinding(updated)
    setSaveStatus('Saving…')
    setTimeout(() => {
      setSaveStatus('Saved')
      onUpdateFinding?.(updated)
    }, 400)
  }

  return (
    <div className={styles.findingLayout}>
      {/* Main Editing Column */}
      <div className={styles.findingMainCol}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={onBackToIndex} className={styles.breadcrumbLink}>
            {t('findingsEditor.editor.backToIndex', { defaultValue: '← Findings and documents' })}
          </button>
          <div
            role="status"
            className={`${styles.saveStatusPill} ${styles.saveStatusNormal}`}
          >
            <span style={{ fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)', fontSize: '12px' }}>✓</span>
            {saveStatus}
          </div>
        </div>

        <div className={styles.findingCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)', fontSize: '12px', color: '#6A6257' }}>
              {finding.code} · {t('findingsEditor.finding.badge', { defaultValue: 'finding' })}
            </span>
            <label style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '13px' }}>
              {t('findingsEditor.finding.statusLabel', { defaultValue: 'Status' })}
              <select
                value={finding.status}
                onChange={(e) => handleFieldChange('status', e.target.value as FindingStatus)}
                className={styles.findingSelect}
              >
                <option value="provisional">Provisional</option>
                <option value="supported">Supported</option>
                <option value="inconclusive">Inconclusive</option>
                <option value="disputed">Disputed</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </label>
          </div>

          <label className={styles.findingField}>
            <span className={styles.findingLabel}>
              {t('findingsEditor.finding.questionLabel', { defaultValue: 'Question' })}
            </span>
            <input
              dir="auto"
              value={finding.question ?? finding.title.replace(/^[A-Z0-9-]+ · /, '')}
              onChange={(e) => {
                handleFieldChange('question', e.target.value)
                handleFieldChange('title', `${finding.code} · ${e.target.value}`)
              }}
              className={`${styles.findingInput} ${styles.findingInputTitle}`}
            />
          </label>

          <label className={styles.findingField}>
            <span className={styles.findingLabel}>
              {t('findingsEditor.finding.claimLabel', { defaultValue: 'Claim or conclusion' })}
            </span>
            <textarea
              dir="auto"
              rows={2}
              value={finding.claim}
              onChange={(e) => handleFieldChange('claim', e.target.value)}
              className={styles.findingTextarea}
            />
          </label>

          <label className={styles.findingField}>
            <span className={styles.findingLabel}>
              {t('findingsEditor.finding.reasoningLabel', { defaultValue: 'Reasoning' })}
            </span>
            <textarea
              dir="auto"
              rows={4}
              value={finding.reasoning}
              onChange={(e) => handleFieldChange('reasoning', e.target.value)}
              className={styles.findingTextarea}
            />
          </label>

          {/* Evidence Grouping */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span className={styles.findingLabel}>
              {t('findingsEditor.finding.evidenceLabel', { defaultValue: 'Evidence' })}
            </span>
            {finding.evidence.map((g) => (
              <div key={g.rel} className={styles.evidenceGroup}>
                <span className={styles.evidenceGroupHeader}>
                  {g.rel} · {g.count}
                </span>
                {g.items.map((item) => (
                  <Link
                    key={item.id}
                    to={`/projects/${projectId}/evidence?q=${item.id}`}
                    className={styles.evidenceLinkCard}
                    style={{ border: `1px ${g.bs} #E3DBCB` }}
                  >
                    <span>{item.t}</span>
                    <span className={styles.evidenceLinkId}>{item.id}</span>
                  </Link>
                ))}
                {g.none ? (
                  <span style={{ fontSize: '13px', color: '#6A6257' }}>
                    {t('findingsEditor.finding.noneLinked', { defaultValue: 'None linked' })}
                  </span>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              className={styles.breadcrumbLink}
              style={{ alignSelf: 'flex-start', marginTop: '4px' }}
            >
              + {t('findingsEditor.finding.linkEvidenceAction', { defaultValue: 'Link evidence' })}
            </button>
          </div>

          <label className={styles.findingField}>
            <span className={styles.findingLabel}>
              {t('findingsEditor.finding.limitationsLabel', { defaultValue: 'Limitations' })}
            </span>
            <textarea
              dir="auto"
              rows={2}
              placeholder={t('findingsEditor.finding.limitationsPlaceholder', {
                defaultValue: "What this finding can't show, and why",
              })}
              value={finding.limitations ?? ''}
              onChange={(e) => handleFieldChange('limitations', e.target.value)}
              className={styles.findingTextarea}
            />
          </label>
        </div>
      </div>

      {/* Sidebar Column */}
      <aside className={styles.findingAside}>
        <div className={styles.asideCard}>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>
            {t('findingsEditor.finding.contributorsHeading', { defaultValue: 'Contributors' })}
          </span>
          {finding.contributors.map((c, idx) => (
            <span key={idx} style={{ fontSize: '13px' }}>
              {c}
            </span>
          ))}
        </div>

        <div className={styles.asideCard}>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>
            {t('findingsEditor.finding.usedInHeading', { defaultValue: 'Used in documents' })}
          </span>
          {finding.usedInDocs.length === 0 ? (
            <span style={{ fontSize: '13px', color: '#6A6257' }}>
              {t('findingsEditor.finding.notUsedInDocs', { defaultValue: 'Not used in any document yet' })}
            </span>
          ) : (
            finding.usedInDocs.map((doc, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onOpenDoc(doc.title)}
                className={styles.breadcrumbLink}
                style={{ textAlign: 'left', fontSize: '13px' }}
              >
                {doc.title} · {doc.section}
              </button>
            ))
          )}
        </div>

        {/* WRT-01 Public Submission Pre-validation Checklist */}
        <div className={styles.submissionWarningCard}>
          <span
            style={{
              fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)',
              fontSize: '11px',
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color: '#4A443B',
            }}
          >
            {t('findingsEditor.finding.submissionChecklistHeading', {
              defaultValue: 'Before public submission',
            })}
          </span>
          {!readiness.isReady ? (
            <span style={{ fontSize: '13px', lineHeight: 1.5, color: '#4A443B' }}>
              {t('findingsEditor.finding.submissionMissingNotice', {
                count: readiness.missingFields.length,
                fields: readiness.missingFields.join(', and at least one '),
                defaultValue: `${readiness.missingFields.length} fields are missing: ${readiness.missingFields.join(', and at least one ')} considered. A provisional finding is fine for now. This is only checked if you submit it for publication.`,
              })}
            </span>
          ) : (
            <span style={{ fontSize: '13px', lineHeight: 1.5, color: '#123B39' }}>
              {t('findingsEditor.finding.submissionReadyNotice', {
                defaultValue: '✓ All required public-submission fields are present: claim, reasoning, limitations, and corroborating/opposing evidence considered.',
              })}
            </span>
          )}
        </div>
      </aside>
    </div>
  )
}
