import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BidiText } from '@/components/BidiText'
import {
  type CitationFootnote,
  type EditorBlock,
  type EditorLayoutMode,
  type MockDocument,
} from './editorModel'
import styles from './FindingEditor.module.css'

interface Props {
  document: MockDocument
  blocks: EditorBlock[]
  notes: CitationFootnote[]
  layout: EditorLayoutMode
  saveState: 'normal' | 'empty' | 'loading' | 'error' | 'conflict'
  localDraftCount?: number
  onBackToIndex: () => void
  onChangeLayout: (mode: EditorLayoutMode) => void
  onToggleBlockDir: (blockId: string) => void
  onUpdateBlockMarkdown?: (blockId: string, newMd: string) => void
  onOpenCite: () => void
  onOpenVersions: () => void
  onSaveRevision: () => void
  onRetrySave?: () => void
}

export function DocumentEditorView({
  document,
  blocks,
  notes,
  layout,
  saveState,
  localDraftCount = 3,
  onBackToIndex,
  onChangeLayout,
  onToggleBlockDir,
  onOpenCite,
  onOpenVersions,
  onSaveRevision,
  onRetrySave,
}: Props) {
  const { t } = useTranslation()
  const [activeBlockId, setActiveBlockId] = useState<string | null>('b5')

  const saveConfig = {
    normal: {
      icon: '✓',
      text: document.lastSavedText,
      className: styles.saveStatusNormal,
    },
    empty: {
      icon: '○',
      text: t('findingsEditor.save.newNotSaved', { defaultValue: 'New document · not saved yet' }),
      className: styles.saveStatusEmpty,
    },
    loading: {
      icon: '…',
      text: t('findingsEditor.save.saving', { defaultValue: 'Saving…' }),
      className: styles.saveStatusLoading,
    },
    error: {
      icon: '!',
      text: t('findingsEditor.save.notSavedDraft', {
        count: localDraftCount,
        defaultValue: `Not saved · ${localDraftCount} changes in local draft`,
      }),
      className: styles.saveStatusError,
    },
    conflict: {
      icon: '!',
      text: t('findingsEditor.save.conflict', { defaultValue: 'Save rejected · conflict' }),
      className: styles.saveStatusConflict,
    },
  }[saveState]

  const showSource = layout !== 'preview'
  const showPreview = layout !== 'source'
  const isEmptyDoc = saveState === 'empty' || blocks.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* Top action bar */}
      <div className={styles.topHeader}>
        <div className={styles.headerTitleCol}>
          <button onClick={onBackToIndex} className={styles.breadcrumbLink}>
            {t('findingsEditor.editor.backToIndex', { defaultValue: '← Findings and documents' })}
          </button>
          <span className={styles.docTitleText}>
            {isEmptyDoc ? t('findingsEditor.editor.untitled', { defaultValue: 'Untitled document' }) : document.title}
          </span>
        </div>

        <div
          role="status"
          aria-live="polite"
          className={`${styles.saveStatusPill} ${saveConfig.className}`}
        >
          <span style={{ fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)', fontSize: '12px' }}>
            {saveConfig.icon}
          </span>
          {saveConfig.text}
        </div>

        <div className={styles.headerActions}>
          <div role="radiogroup" aria-label="Layout" className={styles.layoutGroup}>
            {(['source', 'split', 'preview'] as const).map((mode) => (
              <button
                key={mode}
                role="radio"
                aria-checked={layout === mode}
                onClick={() => onChangeLayout(mode)}
                className={`${styles.layoutRadioBtn} ${
                  layout === mode ? styles.layoutRadioBtnSelected : ''
                }`}
              >
                {mode === 'source'
                  ? t('findingsEditor.layout.source', { defaultValue: 'Source' })
                  : mode === 'split'
                    ? t('findingsEditor.layout.split', { defaultValue: 'Split' })
                    : t('findingsEditor.layout.preview', { defaultValue: 'Preview' })}
              </button>
            ))}
          </div>

          <button onClick={onOpenCite} className={styles.actionButton}>
            {t('findingsEditor.editor.insertCite', { defaultValue: 'Insert citation' })}
          </button>
          <button onClick={onOpenVersions} className={styles.actionButton}>
            {t('findingsEditor.editor.versions', { defaultValue: 'Versions' })}
          </button>
          <button onClick={onSaveRevision} className={styles.primaryActionButton}>
            {t('findingsEditor.editor.commit', { defaultValue: 'Save revision' })}
          </button>
        </div>
      </div>

      {/* Offline Alert Banner */}
      {saveState === 'error' ? (
        <div role="alert" className={styles.offlineAlert}>
          <span>
            <strong style={{ fontWeight: 600, color: '#9a3b24' }}>
              {t('findingsEditor.editor.offlineStrong', { defaultValue: "Not saved. You're offline." })}{' '}
            </strong>
            {t('findingsEditor.editor.offlineBody', {
              count: localDraftCount,
              defaultValue: `Your last ${localDraftCount} changes are kept as a local draft in this browser and will be sent when you reconnect. Don't clear browser data until then.`,
            })}
          </span>
          <button onClick={onRetrySave} className={styles.retryBtn}>
            {t('common.retryNow', { defaultValue: 'Retry now' })}
          </button>
        </div>
      ) : null}

      {/* Loading Skeleton */}
      {saveState === 'loading' ? (
        <div
          aria-busy="true"
          style={{
            padding: '20px clamp(16px, 3vw, 40px)',
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div
            className={styles.skeletonPulse}
            style={{ flex: '1 1 300px', height: '420px', borderRadius: '2px' }}
          />
          <div
            style={{
              flex: '1 1 300px',
              height: '420px',
              background: '#f2ede2',
              borderRadius: '2px',
            }}
          />
        </div>
      ) : (
        /* Panes Container */
        <div className={styles.panesContainer}>
          {/* Source Pane */}
          {showSource ? (
            <section
              aria-label="Markdown source"
              className={styles.sourcePane}
            >
              {isEmptyDoc ? (
                <div
                  style={{
                    padding: '8px 20px 8px 60px',
                    fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)',
                    fontSize: '13px',
                    color: '#8a8276',
                  }}
                >
                  {t('findingsEditor.editor.emptySourceHint', {
                    defaultValue:
                      'Start writing in Markdown. Use # for headings, > for quotations, and Insert citation for sources.',
                  })}
                </div>
              ) : (
                blocks.map((block) => {
                  const isRtl = block.dir === 'rtl'
                  const isFocus = activeBlockId === block.id

                  return (
                    <div
                      key={block.id}
                      className={styles.blockRow}
                      onClick={() => setActiveBlockId(block.id)}
                    >
                      <div className={styles.dirBtnCell}>
                        <button
                          type="button"
                          onClick={() => onToggleBlockDir(block.id)}
                          title="Text direction for this block"
                          aria-label={`Block direction ${isRtl ? 'RTL' : 'LTR'}`}
                          className={styles.dirBtn}
                        >
                          {isRtl ? 'RTL' : 'LTR'}
                        </button>
                      </div>
                      <pre
                        dir={block.dir}
                        className={styles.blockSourcePre}
                        style={{
                          textAlign: isRtl ? 'right' : 'left',
                          fontFamily: isRtl
                            ? 'var(--font-arabic, "Noto Naskh Arabic", serif)'
                            : 'var(--font-mono, "IBM Plex Mono", monospace)',
                          fontSize: isRtl ? '16px' : '13px',
                          borderInlineStart: isFocus ? '2px solid #1f5a57' : '2px solid transparent',
                        }}
                      >
                        {block.md}
                      </pre>
                    </div>
                  )
                })
              )}
            </section>
          ) : null}

          {/* Preview Pane */}
          {showPreview ? (
            <article
              aria-label="Preview"
              className={styles.previewPane}
            >
              {isEmptyDoc ? (
                <div style={{ fontSize: '14px', color: '#6a6257' }}>
                  {t('findingsEditor.editor.emptyPreviewHint', {
                    defaultValue: 'The preview appears here as you write.',
                  })}
                </div>
              ) : (
                blocks.map((b) => {
                  const isRtl = b.dir === 'rtl'
                  const align = isRtl ? 'right' : 'left'

                  if (b.k === 'h') {
                    return (
                      <h2
                        key={b.id}
                        dir={b.dir}
                        className={styles.previewHeading}
                        style={{ textAlign: align }}
                      >
                        {b.text}
                      </h2>
                    )
                  }

                  if (b.k === 'p') {
                    return (
                      <p
                        key={b.id}
                        dir={b.dir}
                        lang={b.lang}
                        className={styles.previewParagraph}
                        style={{
                          textAlign: align,
                          fontFamily: isRtl
                            ? 'var(--font-arabic, "Noto Naskh Arabic", serif)'
                            : 'var(--font-sans, "IBM Plex Sans", sans-serif)',
                          fontSize: isRtl ? '17px' : '15px',
                        }}
                      >
                        <BidiText as="span">{b.text}</BidiText>
                        {b.cite ? (
                          <sup className={styles.previewCiteSup}>[{b.cite}]</sup>
                        ) : null}
                        {b.para ? (
                          <span className={styles.paraphraseBadge}>
                            {t('findingsEditor.editor.paraphraseBadge', { defaultValue: 'Paraphrase' })}
                          </span>
                        ) : null}
                      </p>
                    )
                  }

                  if (b.k === 'q') {
                    return (
                      <figure key={b.id} className={styles.quoteFigure}>
                        <figcaption className={styles.quoteFigcaption}>
                          ❝ Source · exact quotation [{b.cite ?? '1'}]
                        </figcaption>
                        <BidiText
                          as="blockquote"
                          dir="rtl"
                          lang="ar"
                          className={styles.quoteBlockquote}
                        >
                          {b.text}
                        </BidiText>
                      </figure>
                    )
                  }

                  if (b.k === 'list') {
                    return (
                      <ul
                        key={b.id}
                        dir={b.dir}
                        className={styles.previewList}
                        style={{ textAlign: align }}
                      >
                        {(b.items ?? []).map((item, idx) => (
                          <li key={idx}>
                            <BidiText as="span">{item}</BidiText>
                          </li>
                        ))}
                      </ul>
                    )
                  }

                  if (b.k === 'table') {
                    return (
                      <div key={b.id} className={styles.previewTableWrap}>
                        <table className={styles.previewTable}>
                          <thead>
                            <tr>
                              {(b.head ?? []).map((h, idx) => (
                                <th key={idx}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(b.rows ?? []).map((r, idx) => (
                              <tr key={idx}>
                                <td>{r.a}</td>
                                <td
                                  dir="rtl"
                                  lang="ar"
                                  style={{
                                    fontFamily: 'var(--font-arabic, "Noto Naskh Arabic", serif)',
                                    fontSize: '15px',
                                    textAlign: 'right',
                                  }}
                                >
                                  {r.b}
                                </td>
                                <td>{r.c}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  }

                  return null
                })
              )}

              {/* Citations Footnotes */}
              {!isEmptyDoc && notes.length > 0 ? (
                <section
                  aria-label="Citations"
                  className={styles.citationsFootnotes}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)',
                      fontSize: '11px',
                      letterSpacing: '.06em',
                      textTransform: 'uppercase',
                      color: '#6a6257',
                    }}
                  >
                    {t('findingsEditor.editor.citationsFootnotesTitle', { defaultValue: 'Citations' })}
                  </span>
                  {notes.map((n) => (
                    <div key={n.n} className={styles.citationsFootnoteRow}>
                      <span className={styles.footnoteNum}>{n.n}</span>
                      <span style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px', alignItems: 'baseline' }}>
                        <span>{n.text}</span>
                        {n.flag ? <span className={styles.flagBadge}>{n.flag}</span> : null}
                      </span>
                    </div>
                  ))}
                </section>
              ) : null}
            </article>
          ) : null}
        </div>
      )}
    </div>
  )
}
