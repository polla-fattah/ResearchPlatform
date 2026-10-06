import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { useProject } from '@/features/projects/useProject'
import { CitationModal } from './CitationModal'
import { ConflictModal } from './ConflictModal'
import { DocumentEditorView } from './DocumentEditorView'
import {
  INITIAL_BLOCKS,
  INITIAL_DOCUMENTS,
  INITIAL_FINDINGS,
  INITIAL_NOTES,
  INITIAL_VERSIONS,
  type CitationFootnote,
  type CitationKind,
  type EditorBlock,
  type EditorLayoutMode,
  type EditorViewMode,
  type MockDocument,
  type MockFinding,
} from './editorModel'
import { FindingDetailView } from './FindingDetailView'
import { FindingsIndexView } from './FindingsIndexView'
import { VersionsView } from './VersionsView'
import styles from './FindingEditor.module.css'

export function FindingEditorPage() {
  const { t } = useTranslation()
  const { id } = useProject()
  const projectId = id ?? 12

  const [params, setParams] = useSearchParams()
  const viewParam = (params.get('view') as EditorViewMode) || 'editor'
  const stateParam = params.get('st') || 'normal'

  const [view, setView] = useState<EditorViewMode>(
    ['editor', 'member', 'cite', 'finding', 'versions', 'index'].includes(viewParam)
      ? viewParam
      : 'editor',
  )
  const [st, setSt] = useState<string>(stateParam)
  const [layout, setLayout] = useState<EditorLayoutMode>('split')

  // Document & Blocks State
  const [documents, setDocuments] = useState<MockDocument[]>(INITIAL_DOCUMENTS)
  const [findings, setFindings] = useState<MockFinding[]>(INITIAL_FINDINGS)
  const [activeDoc, setActiveDoc] = useState<MockDocument>(INITIAL_DOCUMENTS[0]!)
  const [activeFinding, setActiveFinding] = useState<MockFinding>(INITIAL_FINDINGS[3]!)
  const [blocks, setBlocks] = useState<EditorBlock[]>(INITIAL_BLOCKS)
  const [notes, setNotes] = useState<CitationFootnote[]>(INITIAL_NOTES)

  // Dialog State
  const [citeModalOpen, setCiteModalOpen] = useState(false)
  const [conflictOpen, setConflictOpen] = useState(true)

  // Sync params
  const handleViewChange = (newView: EditorViewMode) => {
    setView(newView)
    setConflictOpen(true)
    const next = new URLSearchParams(params)
    next.set('view', newView)
    setParams(next, { replace: true })
  }

  const handleStateChange = (newSt: string) => {
    setSt(newSt)
    setConflictOpen(true)
    const next = new URLSearchParams(params)
    next.set('st', newSt)
    setParams(next, { replace: true })
  }

  // View compatibility matrix for test reviewer bar
  const APPL: Record<EditorViewMode, string[]> = {
    editor: ['normal', 'empty', 'loading', 'error', 'forbidden', 'conflict'],
    member: ['normal'],
    cite: ['normal'],
    finding: ['normal', 'loading', 'error', 'forbidden'],
    versions: ['normal'],
    index: ['normal', 'empty', 'loading', 'forbidden'],
  }

  const isApplicable = APPL[view]?.includes(st) ?? true
  const effectiveState = isApplicable ? st : 'normal'

  // Block direction toggle
  const handleToggleBlockDir = (blockId: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id === blockId) {
          const nextDir = b.dir === 'rtl' ? 'ltr' : 'rtl'
          return { ...b, dir: nextDir }
        }
        return b
      }),
    )
  }

  // Citation insertion
  const handleInsertCitation = (data: {
    evidenceId: string
    kind: CitationKind
    snippet: string
    formattedCitation: string
    hasFlag: boolean
  }) => {
    const nextNum = String(notes.length + 1)
    const newBlock: EditorBlock = {
      id: `b_cite_${Date.now()}`,
      k: data.kind === 'quote' ? 'q' : 'p',
      dir: data.kind === 'quote' ? 'rtl' : 'ltr',
      lang: data.kind === 'quote' ? 'ar' : undefined,
      md: data.snippet,
      text: data.snippet.replace(/^[>«»\s]+|\[@.*?\]/g, '').trim(),
      cite: nextNum,
      para: data.kind === 'para',
    }

    setBlocks((prev) => [...prev, newBlock])
    setNotes((prev) => [
      ...prev,
      {
        n: nextNum,
        text: data.formattedCitation,
        flag: data.hasFlag ? 'Incomplete citation · page' : undefined,
      },
    ])
    setCiteModalOpen(false)
    if (view === 'cite') handleViewChange('editor')
  }

  // Version restore
  const handleRestoreVersion = (versionNum: number) => {
    const nextVersionNum = activeDoc.versionNumber + 1
    const updatedDoc = {
      ...activeDoc,
      versionNumber: nextVersionNum,
      lastSavedText: `Saved just now · restored from v${versionNum} as v${nextVersionNum}`,
    }
    setActiveDoc(updatedDoc)
    setDocuments((prev) => prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d)))
    handleViewChange('editor')
  }

  // Commit revision
  const handleSaveRevision = () => {
    const nextVersionNum = activeDoc.versionNumber + 1
    const updatedDoc = {
      ...activeDoc,
      versionNumber: nextVersionNum,
      lastSavedText: `Saved just now · v${nextVersionNum}`,
    }
    setActiveDoc(updatedDoc)
    setDocuments((prev) => prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d)))
  }

  const showConflictDialog =
    (view === 'editor' && effectiveState === 'conflict' && conflictOpen) ||
    (view === 'member' && conflictOpen)

  const isMemberConflict = view === 'member'

  return (
    <div className={styles.page}>
      {/* Review bar for dev / contract / mockup alignment */}
      <div data-screen-label="11 review bar" className={styles.reviewBar}>
        <div className={styles.reviewMeta}>
          <span className={styles.reviewTitle}>11 · {t('findingsEditor.reviewTitle', { defaultValue: 'Finding and document editor' })}</span>
          <span className={styles.reviewReqs}>WRT-01 · 02 · 03 · 04 · 05 · 06 · EVI-03 · 05 · 06</span>
          <Link to="/home" className={styles.reviewPlanLink}>
            ← Plan
          </Link>
        </div>

        <div className={styles.chipsRow}>
          <span className={styles.chipsLabel}>View</span>
          {(
            [
              ['editor', 'Document editor'],
              ['member', 'Member edit conflict'],
              ['cite', 'Insert citation'],
              ['finding', 'Finding'],
              ['versions', 'Versions & compare'],
              ['index', 'Findings & documents'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => handleViewChange(v as EditorViewMode)}
              className={`${styles.chipBtn} ${view === v ? styles.chipBtnActive : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className={styles.chipsRow}>
          <span className={styles.chipsLabel}>State</span>
          {(['normal', 'empty', 'loading', 'error', 'forbidden', 'conflict'] as const).map(
            (s) => {
              const active = st === s
              const applicable = APPL[view]?.includes(s) ?? true
              return (
                <button
                  key={s}
                  onClick={() => handleStateChange(s)}
                  style={{ opacity: applicable ? 1 : 0.4 }}
                  className={`${styles.chipBtn} ${active ? styles.stateChipActive : ''}`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              )
            },
          )}
          {!isApplicable ? (
            <span style={{ fontSize: '12px', color: '#D9C9A3', marginLeft: '8px' }}>
              {st.charAt(0).toUpperCase() + st.slice(1)}: not applicable on this view (per spec). Showing normal.
            </span>
          ) : null}
        </div>
      </div>

      <div className={styles.workspace}>
        {/* State: Forbidden (DEF-2 existence disclosure rule) */}
        {effectiveState === 'forbidden' ? (
          <div style={{ padding: '40px clamp(16px,3vw,40px)' }}>
            <div
              style={{
                maxWidth: '640px',
                background: '#FFFDF8',
                border: '1px dashed #8A8276',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <h1 style={{ fontFamily: 'var(--font-serif, "Newsreader", serif)', fontWeight: 500, fontSize: '28px', margin: 0 }}>
                {t('findingsEditor.forbidden.title', { defaultValue: 'Document not available' })}
              </h1>
              <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.6, color: '#4A443B' }}>
                {t('findingsEditor.forbidden.body', {
                  defaultValue:
                    'This document or finding doesn’t exist in this project, or you can’t open it. A citation link from another project never opens content here.',
                })}
              </p>
              <button
                onClick={() => handleViewChange('index')}
                className={styles.actionButton}
                style={{ alignSelf: 'flex-start' }}
              >
                {t('findingsEditor.index.heading', { defaultValue: 'Findings and documents' })}
              </button>
            </div>
          </div>
        ) : view === 'index' ? (
          /* View: Index */
          <FindingsIndexView
            documents={documents}
            findings={findings}
            isEmpty={effectiveState === 'empty'}
            isLoading={effectiveState === 'loading'}
            onSelectDoc={(d) => {
              setActiveDoc(d)
              handleViewChange('editor')
            }}
            onSelectFinding={(f) => {
              setActiveFinding(f)
              handleViewChange('finding')
            }}
            onNewDoc={() => {
              const newD: MockDocument = {
                id: Date.now(),
                title: 'Untitled document',
                meta: 'v1 · newly created',
                links: '0 findings · 0 citations',
                content: '',
                versionNumber: 1,
                lastSavedText: 'New document · not saved yet',
                findingsCount: 0,
                citationsCount: 0,
              }
              setActiveDoc(newD)
              setDocuments((prev) => [newD, ...prev])
              setBlocks([])
              setNotes([])
              handleViewChange('editor')
              handleStateChange('empty')
            }}
            onNewFinding={() => {
              const newF: MockFinding = {
                id: Date.now(),
                code: `F-${String(findings.length + 1).padStart(2, '0')}`,
                title: `F-${String(findings.length + 1).padStart(2, '0')} · New research finding`,
                claim: '',
                reasoning: '',
                limitations: '',
                meta: '0 supporting',
                status: 'provisional',
                bs: 'solid',
                evidence: [
                  { rel: 'Supporting', count: '0 evidence items', bs: 'solid', none: true, items: [] },
                  { rel: 'Opposing', count: '0 evidence items', bs: 'solid', none: true, items: [] },
                  { rel: 'Contextual', count: '0 evidence items', bs: 'solid', none: true, items: [] },
                  { rel: 'Unresolved', count: '0 evidence items', bs: 'dashed', none: true, items: [] },
                ],
                contributors: ['Shilan Rashid · author'],
                usedInDocs: [],
              }
              setActiveFinding(newF)
              setFindings((prev) => [newF, ...prev])
              handleViewChange('finding')
            }}
          />
        ) : view === 'finding' ? (
          /* View: Finding Detail */
          <FindingDetailView
            finding={activeFinding}
            projectId={projectId}
            onBackToIndex={() => handleViewChange('index')}
            onOpenDoc={(title) => {
              const doc = documents.find((d) => d.title === title) ?? documents[0]!
              setActiveDoc(doc)
              handleViewChange('editor')
            }}
            onUpdateFinding={(updated) => {
              setActiveFinding(updated)
              setFindings((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
            }}
          />
        ) : view === 'versions' ? (
          /* View: Versions & Compare */
          <VersionsView
            documentTitle={activeDoc.title}
            versions={INITIAL_VERSIONS}
            onBackToEditor={() => handleViewChange('editor')}
            onRestoreVersion={handleRestoreVersion}
          />
        ) : (
          /* View: Document Editor (and cite / member view anchors) */
          <DocumentEditorView
            document={activeDoc}
            blocks={effectiveState === 'empty' ? [] : blocks}
            notes={effectiveState === 'empty' ? [] : notes}
            layout={layout}
            saveState={
              effectiveState === 'conflict'
                ? 'conflict'
                : effectiveState === 'error'
                  ? 'error'
                  : effectiveState === 'loading'
                    ? 'loading'
                    : effectiveState === 'empty'
                      ? 'empty'
                      : 'normal'
            }
            localDraftCount={3}
            onBackToIndex={() => handleViewChange('index')}
            onChangeLayout={setLayout}
            onToggleBlockDir={handleToggleBlockDir}
            onOpenCite={() => setCiteModalOpen(true)}
            onOpenVersions={() => handleViewChange('versions')}
            onSaveRevision={handleSaveRevision}
            onRetrySave={() => handleStateChange('normal')}
          />
        )}
      </div>

      {/* Citation Modal */}
      <CitationModal
        isOpen={citeModalOpen || view === 'cite'}
        onClose={() => {
          setCiteModalOpen(false)
          if (view === 'cite') handleViewChange('editor')
        }}
        onInsert={handleInsertCitation}
      />

      {/* Conflict Dialog Modal (DEF-8 / COL-06) */}
      <ConflictModal
        isOpen={showConflictDialog}
        isMemberConflict={isMemberConflict}
        onClose={() => setConflictOpen(false)}
        onKeepExisting={() => {
          setConflictOpen(false)
          handleStateChange('normal')
        }}
        onMergeByHand={() => {
          setConflictOpen(false)
          handleStateChange('normal')
        }}
        onSaveAsNewHead={() => {
          setConflictOpen(false)
          handleSaveRevision()
          handleStateChange('normal')
        }}
      />
    </div>
  )
}
