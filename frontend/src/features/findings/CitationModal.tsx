import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BidiText } from '@/components/BidiText'
import { type CitationKind } from './editorModel'
import styles from './FindingEditor.module.css'

interface Props {
  isOpen: boolean
  onClose: () => void
  onInsert: (data: {
    evidenceId: string
    kind: CitationKind
    snippet: string
    formattedCitation: string
    hasFlag: boolean
  }) => void
}

export function CitationModal({ isOpen, onClose, onInsert }: Props) {
  const { t } = useTranslation()
  const [selectedEv, setSelectedEv] = useState('EV-0040')
  const [mode, setMode] = useState<CitationKind>('quote')

  if (!isOpen) return null

  const evidenceOptions = [
    {
      id: 'EV-0040',
      label: 'EV-0040 · Sunan al-Nasāʾī 84: “three times each”',
      arabicText: 'تَوَضَّأَ ثَلاَثًا ثَلاَثًا',
      work: 'al-Sunan (al-Nasāʾī)',
      edition: 'ed. Abū Ghudda',
      volPage: '1 / Unknown',
      pageFlag: 'Missing page',
      sourceNo: '84 (al-Nasāʾī numbering)',
      corpusVer: 'v2026.09 snapshot',
      formatted: 'al-Nasāʾī, al-Sunan, ed. Abū Ghudda, 1:[page unknown], no. 84.',
    },
    {
      id: 'EV-0004',
      label: 'EV-0004 · Sunan Abī Dāwūd 106',
      arabicText: 'أَنَّ النَّبِيَّ صلى الله عليه وسلم تَوَضَّأَ ثَلاَثًا ثَلاَثًا',
      work: 'al-Sunan (Abū Dāwūd)',
      edition: 'ed. al-Arnaʾūṭ (2009)',
      volPage: '1:78',
      pageFlag: '',
      sourceNo: '106 (Abū Dāwūd numbering)',
      corpusVer: 'v2026.09 snapshot',
      formatted: 'Abū Dāwūd, al-Sunan, ed. al-Arnaʾūṭ (2009), 1:78, no. 106.',
    },
    {
      id: 'EV-0007',
      label: 'EV-0007 · Sunan al-Tirmidhī 44',
      arabicText: 'تَوَضَّأَ مَرَّةً مَرَّةً ... ثَلاَثًا ثَلاَثًا',
      work: 'al-Sunan (al-Tirmidhī)',
      edition: 'ed. Shākir',
      volPage: '1:63',
      pageFlag: '',
      sourceNo: '44 (al-Tirmidhī numbering)',
      corpusVer: 'v2026.09 snapshot',
      formatted: 'al-Tirmidhī, al-Sunan, ed. Shākir, 1:63, no. 44.',
    },
  ]

  const activeOption =
    evidenceOptions.find((e) => e.id === selectedEv) ?? evidenceOptions[0]!

  const handleConfirm = () => {
    const isQuote = mode === 'quote'
    const snippet = isQuote
      ? `> «${activeOption.arabicText}» [@${activeOption.id} exact]`
      : `[@${activeOption.id} paraphrase]`

    onInsert({
      evidenceId: activeOption.id,
      kind: mode,
      snippet,
      formattedCitation: `${activeOption.formatted} ${isQuote ? 'Exact quotation.' : 'Paraphrase.'}`,
      hasFlag: !!activeOption.pageFlag,
    })
  }

  return (
    <div className={styles.modalBackdrop}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cite-modal-title"
        className={styles.modalDialog}
      >
        <h2 id="cite-modal-title" className={styles.modalTitle}>
          {t('findingsEditor.citeModal.title', { defaultValue: 'Insert citation' })}
        </h2>

        <label className={styles.findingField}>
          <span className={styles.findingLabel}>
            {t('findingsEditor.citeModal.evidenceLabel', { defaultValue: 'Evidence' })}
          </span>
          <select
            value={selectedEv}
            onChange={(e) => setSelectedEv(e.target.value)}
            className={styles.findingSelect}
          >
            {evidenceOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset style={{ border: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <legend style={{ fontSize: '14px', fontWeight: 600, padding: 0, marginBottom: '6px' }}>
            {t('findingsEditor.citeModal.insertAs', { defaultValue: 'Insert as' })}
          </legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <label
              className={styles.citeModeCard}
              style={{
                border: mode === 'quote' ? '1px solid #1f5a57' : '1px solid #cfc6b4',
                background: mode === 'quote' ? '#e3eeec' : '#ffffff',
              }}
            >
              <input
                type="radio"
                name="cm"
                checked={mode === 'quote'}
                onChange={() => setMode('quote')}
              />
              <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>
                  {t('findingsEditor.citeModal.exactQuote', { defaultValue: 'Exact quotation' })}
                </span>
                <span style={{ fontSize: '12px', lineHeight: 1.45, color: '#4a443b' }}>
                  {t('findingsEditor.citeModal.exactQuoteSub', {
                    defaultValue: 'Inserts the original text unchanged, marked as Source.',
                  })}
                </span>
              </span>
            </label>

            <label
              className={styles.citeModeCard}
              style={{
                border: mode === 'para' ? '1px solid #1f5a57' : '1px solid #cfc6b4',
                background: mode === 'para' ? '#e3eeec' : '#ffffff',
              }}
            >
              <input
                type="radio"
                name="cm"
                checked={mode === 'para'}
                onChange={() => setMode('para')}
              />
              <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>
                  {t('findingsEditor.citeModal.paraphrase', { defaultValue: 'Paraphrase' })}
                </span>
                <span style={{ fontSize: '12px', lineHeight: 1.45, color: '#4a443b' }}>
                  {t('findingsEditor.citeModal.paraphraseSub', {
                    defaultValue: 'Your own wording. It is never shown as a quotation.',
                  })}
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        {/* Live citation preview */}
        <div className={styles.previewCitationBox}>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>
            {t('findingsEditor.citeModal.previewHeading', { defaultValue: 'Preview' })}
          </span>

          {mode === 'quote' ? (
            <div
              style={{
                borderInlineStart: '3px solid #1d1a15',
                paddingInlineStart: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)',
                  fontSize: '10px',
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                }}
              >
                ❝ Source · exact quotation
              </span>
              <BidiText
                as="span"
                dir="rtl"
                lang="ar"
                style={{
                  fontFamily: 'var(--font-arabic, "Noto Naskh Arabic", serif)',
                  fontSize: '19px',
                  textAlign: 'right',
                }}
              >
                {activeOption.arabicText}
              </BidiText>
            </div>
          ) : (
            <div style={{ fontSize: '14px', lineHeight: 1.6 }}>
              {activeOption.work} records the “three times” wording on this route.{' '}
              <span className={styles.paraphraseBadge}>Paraphrase</span>
            </div>
          )}

          <div className={styles.previewMetaGrid}>
            <span style={{ color: '#6a6257' }}>Work</span>
            <span>{activeOption.work}</span>

            <span style={{ color: '#6a6257' }}>Edition</span>
            <span>{activeOption.edition}</span>

            <span style={{ color: '#6a6257' }}>Volume / page</span>
            <span style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
              <span>{activeOption.volPage}</span>
              {activeOption.pageFlag ? (
                <span className={styles.flagBadge}>{activeOption.pageFlag}</span>
              ) : null}
            </span>

            <span style={{ color: '#6a6257' }}>Source number</span>
            <span>{activeOption.sourceNo}</span>

            <span style={{ color: '#6a6257' }}>Corpus version</span>
            <span>{activeOption.corpusVer}</span>
          </div>

          <div style={{ fontSize: '13px', paddingTop: '8px', borderTop: '1px solid #e3dbcb' }}>
            <em>{activeOption.formatted}</em>
          </div>
        </div>

        <div style={{ fontSize: '12px', lineHeight: 1.5, color: '#6a6257' }}>
          {t('findingsEditor.citeModal.notice', {
            defaultValue:
              'Source numbers are the compiler’s own numbering, not the platform’s report ID. Bibliography entries used by citations can’t be deleted without first listing the citations that depend on them.',
          })}
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button onClick={onClose} className={styles.actionButton}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </button>
          <button onClick={handleConfirm} className={styles.primaryActionButton}>
            {activeOption.pageFlag
              ? t('findingsEditor.citeModal.insertWithFlag', { defaultValue: 'Insert with flag' })
              : t('findingsEditor.citeModal.insert', { defaultValue: 'Insert citation' })}
          </button>
        </div>
      </div>
    </div>
  )
}
