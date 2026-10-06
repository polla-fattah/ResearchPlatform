import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { deleteDocument, unlinkFindingFromDocument } from '@/api/documents'
import { invalidate } from '@/api/invalidate'
import type { EvidenceItem } from '@/api/schemas/evidence'
import type { DocumentItem, DocumentVersion } from '@/api/schemas/writing'
import { usePreferences } from '@/app/preferencesContext'
import { NeutralState } from '@/components/Badges'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { ConfirmAction } from '@/components/ConfirmAction'
import { MutationNotice } from '@/components/MutationNotice'
import { CitationDialog } from './CitationDialog'
import { ConflictDialog } from './ConflictDialog'
import { LinkFindingDialog, RenameDialog } from './DocumentDialogs'
import { MarkdownEditor, type EditorHandle } from './MarkdownEditor'
import { MarkdownPreview } from './MarkdownPreview'
import { VersionsView } from './VersionsView'
import { useCitationPayload, useCitationRows } from './useCitations'
import { useDocumentEditor } from './useDocumentEditor'
import { useEditLock } from './useEditLock'
import { findingCode, type EditorStart } from './writingModel'
import styles from './Writing.module.css'

interface Props {
  projectId: number
  doc: DocumentItem
  start: EditorStart
  evidence: readonly EvidenceItem[]
  canEdit: boolean
  showVersions: boolean
  onVersions: (show: boolean) => void
  onBack: () => void
  onOpenFinding: (id: number) => void
  onDeleted: () => void
}

type Dialog = null | 'cite' | 'rename' | 'delete' | 'link'

/**
 * The writing screen for one document. The text, what it is based on, and everything that happens to it are owned
 * by `useDocumentEditor`; this component only shows them. The editor stays mounted behind the version history
 * (hidden, not removed), so opening the history can never lose unsaved text.
 */
export function DocumentEditor({ projectId, doc, start, evidence, canEdit, showVersions, onVersions, onBack, onOpenFinding, onDeleted }: Props) {
  const { t } = useTranslation()
  const { relative, date } = usePreferences()
  const qc = useQueryClient()
  const handle = useRef<EditorHandle>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [summary, setSummary] = useState('')

  const lock = useEditLock(projectId, doc.id, canEdit)
  const canType = canEdit && lock.state === 'held'
  const payloadFor = useCitationPayload(projectId, evidence)
  const editor = useDocumentEditor({
    projectId,
    documentId: doc.id,
    initial: start,
    canEdit: canType,
    citationsFor: payloadFor,
  })
  const { state } = editor
  const rows = useCitationRows(projectId, doc.id, state.text, evidence)

  const remove = useMutation({
    mutationFn: () => deleteDocument(projectId, doc.id),
    onSuccess: async () => {
      await invalidate.documentsChanged(qc, projectId)
      onDeleted()
    },
    onError: () => setDialog(null),
  })
  const unlink = useMutation({
    mutationFn: (findingId: number) => unlinkFindingFromDocument(projectId, doc.id, findingId),
    onSuccess: () => invalidate.documentsChanged(qc, projectId),
  })

  const when = (ms: number | null) => (ms ? relative(new Date(ms)) : '')
  const saveBusy = state.status === 'savingVersion'

  const statusText = {
    idle: t('writing.save.idle', { version: state.baseVersion }),
    saved: t('writing.save.saved', { version: state.baseVersion }),
    dirty: t('writing.save.dirty'),
    savingDraft: t('writing.save.savingDraft'),
    draftSaved: t('writing.save.draftSaved', { when: when(state.savedAt) }),
    savingVersion: t('writing.save.savingVersion'),
    error: t('writing.save.error'),
    offline: t('writing.save.offline'),
    conflict: t('writing.save.conflict'),
  }[state.status]

  return (
    <section>
      <div hidden={showVersions}>
        <div className={styles.docHead}>
          <Button variant="ghost" onClick={onBack}>
            {t('writing.back')}
          </Button>
          <h1 className={styles.docTitle}>
            <BidiText>{doc.title || t('writing.doc.untitled')}</BidiText>
          </h1>
          {canEdit ? (
            <Button variant="ghost" onClick={() => setDialog('rename')}>
              {t('writing.doc.rename')}
            </Button>
          ) : null}
          <span className={styles.status} role="status" aria-live="polite" data-status={state.status}>
            {statusText}
          </span>
          <div className={styles.docActions}>
            <Button disabled={!canType} onClick={() => setDialog('cite')}>
              {t('writing.doc.insertCitation')}
            </Button>
            <Button onClick={() => onVersions(true)}>{t('writing.doc.versions')}</Button>
            {canType ? (
              <>
                <input
                  className={styles.summaryInput}
                  value={summary}
                  aria-label={t('writing.doc.summary')}
                  placeholder={t('writing.doc.summary')}
                  onChange={(e) => setSummary(e.target.value)}
                />
                <Button
                  variant="primary"
                  disabled={saveBusy || state.status === 'saved' || state.status === 'idle'}
                  onClick={() => {
                    editor.saveVersion(summary.trim())
                    setSummary('')
                  }}
                >
                  {t('writing.doc.save')}
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {lock.state === 'other' ? (
          <div className={styles.banner} role="status">
            <p>
              {t('writing.doc.lockedBy', {
                who: lock.lockedBy ?? t('writing.doc.lockedByUnknown'),
                until: lock.until ? date(lock.until, { time: true }) : '',
              })}
            </p>
            <Button onClick={lock.recheck}>{t('writing.doc.lockRetry')}</Button>
          </div>
        ) : null}
        {lock.state === 'failed' ? (
          <div className={styles.banner} role="alert">
            <p>{t('writing.doc.lockFailed')}</p>
            <Button onClick={lock.recheck}>{t('writing.doc.lockRetry')}</Button>
          </div>
        ) : null}
        {!canEdit ? <p className={styles.hint}>{t('writing.doc.readOnly')}</p> : null}
        {start.restored && canEdit ? (
          <p className={styles.note} role="status">
            {t('writing.doc.restoredDraft', { when: when(start.restored.at) })}
          </p>
        ) : null}
        {state.status === 'offline' ? (
          <div className={styles.banner} role="alert">
            <p>
              <strong>{t('writing.save.offline')}</strong> {t('writing.save.offlineBody')}
            </p>
            <Button onClick={editor.retry}>{t('writing.save.retry')}</Button>
          </div>
        ) : null}
        {state.status === 'error' ? (
          <div className={styles.banner} role="alert">
            <MutationNotice error={editor.draftError ?? editor.versionError} title={t('writing.save.error')}>
              <Button onClick={editor.retry}>{t('writing.save.retry')}</Button>
            </MutationNotice>
          </div>
        ) : null}

        {state.shelved !== null ? (
          <aside className={styles.shelved} aria-label={t('writing.doc.shelved')}>
            <h3>{t('writing.doc.shelved')}</h3>
            <p className={styles.hint}>{t('writing.doc.shelvedHint')}</p>
            <pre className={styles.shelvedText} dir="auto">
              <BidiText>{state.shelved}</BidiText>
            </pre>
            <div className={styles.inline}>
              {canType ? <Button onClick={editor.appendShelved}>{t('writing.doc.shelvedInsert')}</Button> : null}
              <Button variant="ghost" onClick={editor.dropShelved}>
                {t('writing.doc.shelvedDismiss')}
              </Button>
            </div>
          </aside>
        ) : null}

        <div className={styles.panes}>
          <section className={styles.pane} aria-label={t('writing.doc.markdown')}>
            <h2 className={styles.paneTitle}>{t('writing.doc.markdown')}</h2>
            <MarkdownEditor
              ref={handle}
              value={state.text}
              onChange={editor.type}
              readOnly={!canType}
              label={t('writing.doc.markdown')}
              placeholder={t('writing.doc.emptyPlaceholder')}
            />
            <p className={styles.hint}>{t('writing.doc.length', { count: state.text.length })}</p>
          </section>

          <section className={styles.pane} aria-label={t('writing.doc.preview')}>
            <h2 className={styles.paneTitle}>{t('writing.doc.preview')}</h2>
            <MarkdownPreview text={state.text} empty={t('writing.doc.previewEmpty')} />

            <h3 className={styles.paneTitle}>{t('writing.doc.citations')}</h3>
            {rows.length === 0 ? <p className={styles.hint}>{t('writing.doc.citationsNone')}</p> : null}
            <ol className={styles.citations}>
              {rows.map((r) => (
                <li key={r.cited.id} value={r.cited.number}>
                  {r.evidence ? (
                    <>
                      <span className="mono">{r.cited.code}</span> <BidiText>{r.formatted}</BidiText>
                      {r.incompleteLocator ? (
                        <>
                          {' '}
                          <NeutralState kind="incompleteCitation">{t('writing.doc.incompleteLocator')}</NeutralState>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <NeutralState kind="unknown">{t('writing.doc.unknownEvidence', { code: r.cited.code })}</NeutralState>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <section className={styles.section} aria-label={t('writing.doc.findings')}>
          <h2 className={styles.paneTitle}>{t('writing.doc.findings')}</h2>
          {(doc.findings ?? []).length === 0 ? <p className={styles.hint}>{t('writing.doc.findingsNone')}</p> : null}
          <ul className={styles.plain}>
            {(doc.findings ?? []).map((f) => (
              <li key={f.id} className={styles.rowLine}>
                <button type="button" className={styles.linkButton} onClick={() => onOpenFinding(f.id)}>
                  <span className="mono">{findingCode(f.id)}</span> <BidiText>{f.claim}</BidiText>
                </button>
                {canEdit ? (
                  <Button variant="ghost" disabled={unlink.isPending} onClick={() => unlink.mutate(f.id)} aria-label={`${t('writing.doc.unlinkFinding')} ${findingCode(f.id)}`}>
                    {t('writing.doc.unlinkFinding')}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          <MutationNotice error={unlink.error} title={t('writing.doc.linkFindingFailed')} />
          {canEdit ? <Button onClick={() => setDialog('link')}>{t('writing.doc.linkFinding')}</Button> : null}
        </section>

        {canEdit ? (
          <div className={styles.dangerRow}>
            <Button variant="danger" onClick={() => setDialog('delete')}>
              {t('writing.doc.delete')}
            </Button>
          </div>
        ) : null}
        <MutationNotice error={remove.error} title={t('writing.doc.deleteFailed')} />
      </div>

      {showVersions ? (
        <VersionsView
          projectId={projectId}
          documentId={doc.id}
          title={doc.title}
          canEdit={canType}
          onBack={() => onVersions(false)}
          onRestored={(restored: DocumentVersion) => {
            editor.replaceWith(restored.content, restored.version_number)
            onVersions(false)
          }}
        />
      ) : null}

      {dialog === 'cite' ? (
        <CitationDialog
          projectId={projectId}
          documentId={doc.id}
          evidence={evidence}
          onInsert={(text) => handle.current?.insertAtCursor(text)}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog === 'link' ? <LinkFindingDialog projectId={projectId} doc={doc} onClose={() => setDialog(null)} /> : null}

      {dialog === 'rename' ? <RenameDialog projectId={projectId} doc={doc} onClose={() => setDialog(null)} /> : null}

      <ConfirmAction
        open={dialog === 'delete'}
        danger
        title={t('writing.doc.deleteTitle', { title: doc.title })}
        confirmLabel={t('writing.doc.deleteConfirm')}
        busy={remove.isPending}
        onCancel={() => setDialog(null)}
        onConfirm={() => remove.mutate()}
      >
        <p>{t('writing.doc.deleteBody')}</p>
      </ConfirmAction>

      {state.status === 'conflict' && state.conflict ? (
        <ConflictDialog
          conflict={state.conflict}
          mine={state.text}
          baseVersion={state.baseVersion}
          error={editor.versionError}
          busy={saveBusy}
          onOpenTheirs={editor.openTheirs}
          onSaveMine={() => editor.saveMineOnTop(summary.trim())}
          onLater={editor.decideLater}
        />
      ) : null}
    </section>
  )
}
