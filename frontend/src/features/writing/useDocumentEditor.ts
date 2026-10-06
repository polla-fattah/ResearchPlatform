import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useReducer } from 'react'
import { ApiError } from '@/api/errors'
import { createVersion, saveConflict, saveDraft, type NewVersion } from '@/api/documents'
import { invalidate } from '@/api/invalidate'
import { editorReducer, hasUnsavedText, initialEditorState, type EditorStatus } from './editorState'
import { clearLocalDraft, writeLocalDraft } from './localDraft'

/** How long typing must pause before the draft is autosaved. */
export const AUTOSAVE_MS = 2000

interface Options {
  projectId: number
  documentId: number
  initial: { text: string; baseVersion: number; status?: EditorStatus; savedAt?: number | null }
  /** Read-only roles never save anything. */
  canEdit: boolean
  /** The citations to store with a version, worked out from the text and the project's evidence. */
  citationsFor: (text: string) => NewVersion['citations']
}

const isOffline = (err: unknown) => err instanceof ApiError && err.code === 'NETWORK'

/**
 * Everything that happens to the text being edited: autosaving a draft, saving a version, going offline, a refused
 * save, and the choices after it. The rules are in `editorReducer`; this hook only connects them to the server and the
 * clock (state rule S12). It owns no server data: the document the editor opened from is the caller's query.
 */
export function useDocumentEditor({ projectId, documentId, initial, canEdit, citationsFor }: Options) {
  const qc = useQueryClient()
  const [state, dispatch] = useReducer(editorReducer, initial, initialEditorState)

  const keepLocally = (text: string, baseVersion: number) =>
    writeLocalDraft(projectId, documentId, { text, baseVersion, at: Date.now() }) // audit-ok: in a callback, not in render

  const draft = useMutation({
    mutationFn: (text: string) => saveDraft(projectId, documentId, text, state.baseVersion),
    onSuccess: (_saved, text) => {
      clearLocalDraft(projectId, documentId)
      dispatch({ type: 'draftSaved', text, at: Date.now() }) // audit-ok: in a callback, not in render
    },
    onError: (err, text) => {
      if (isOffline(err)) keepLocally(text, state.baseVersion)
      dispatch({ type: 'failed', reason: isOffline(err) ? 'offline' : 'error' })
    },
  })

  const { mutate: sendDraft } = draft

  const version = useMutation({
    mutationFn: ({ text, summary, base }: { text: string; summary?: string; base?: number }) =>
      createVersion(projectId, documentId, {
        content: text,
        change_summary: summary || undefined,
        expected_version: base ?? state.baseVersion,
        citations: citationsFor(text),
      }),
    onSuccess: (saved, { text }) => {
      clearLocalDraft(projectId, documentId)
      dispatch({ type: 'versionSaved', text, version: saved.version_number, at: Date.now() }) // audit-ok: in a callback, not in render
      void invalidate.documentsChanged(qc, projectId)
    },
    onError: (err, { text, base }) => {
      const conflict = saveConflict(err)
      if (conflict) {
        dispatch({ type: 'conflicted', conflict })
        return
      }
      if (isOffline(err)) keepLocally(text, base ?? state.baseVersion)
      dispatch({ type: 'failed', reason: isOffline(err) ? 'offline' : 'error' })
    },
  })

  // Autosave the draft after a pause in typing. Typing again restarts the pause.
  useEffect(() => {
    if (!canEdit || state.status !== 'dirty') return
    const timer = setTimeout(() => {
      dispatch({ type: 'draftSaving' })
      sendDraft(state.text)
    }, AUTOSAVE_MS)
    return () => clearTimeout(timer)
  }, [canEdit, state.status, state.text, sendDraft])

  // Back online: send what was kept.
  useEffect(() => {
    if (state.status !== 'offline') return
    const onOnline = () => {
      dispatch({ type: 'draftSaving' })
      sendDraft(state.text)
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [state.status, state.text, sendDraft])

  // Leaving the page with text that is only a draft asks first.
  useEffect(() => {
    if (!hasUnsavedText(state)) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [state])

  const retry = () => {
    dispatch({ type: 'draftSaving' })
    sendDraft(state.text)
  }

  return {
    state,
    type: (text: string) => dispatch({ type: 'typed', text }),
    saveVersion: (summary?: string) => {
      if (!canEdit) return
      dispatch({ type: 'versionSaving' })
      version.mutate({ text: state.text, summary })
    },
    /** After a refused save: keep my text and save it as the next version on top of theirs. */
    saveMineOnTop: (summary?: string) => {
      const base = state.conflict?.current_version
      if (base === undefined) return
      dispatch({ type: 'saveMineOnTop' })
      dispatch({ type: 'versionSaving' })
      version.mutate({ text: state.text, summary, base })
    },
    openTheirs: () => dispatch({ type: 'openTheirs' }),
    decideLater: () => dispatch({ type: 'decideLater' }),
    retry,
    /** After a restore: the editor now shows another text on another version. */
    replaceWith: (text: string, baseVersion: number) => {
      clearLocalDraft(projectId, documentId)
      dispatch({ type: 'replace', text, baseVersion, at: Date.now() }) // audit-ok: in a callback, not in render
    },
    appendShelved: () => dispatch({ type: 'appendShelved' }),
    dropShelved: () => dispatch({ type: 'dropShelved' }),
    draftError: draft.error,
    versionError: version.error,
  }
}
