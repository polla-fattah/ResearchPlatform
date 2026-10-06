import type { SaveConflict } from '@/api/schemas/writing'

/**
 * The document editor as an explicit state machine (state rule S12). Everything about "what is the text, what is it
 * based on and what has happened to it" lives here, in one pure reducer, so every transition can be tested without a
 * screen or a clock.
 *
 *   idle ──type──▶ dirty ──pause──▶ savingDraft ──ok──▶ draftSaved
 *                    │                   └──network──▶ offline ──retry──▶ savingDraft
 *                    └──Save version──▶ savingVersion ──ok──▶ saved
 *                                            ├──409──▶ conflict ──▶ (open theirs | save mine on top | later)
 *                                            └──network──▶ offline
 */
export type EditorStatus =
  | 'idle'
  | 'dirty'
  | 'savingDraft'
  | 'draftSaved'
  | 'savingVersion'
  | 'saved'
  | 'offline'
  | 'error'
  | 'conflict'

export interface EditorState {
  /** The text in the editor. */
  text: string
  /** The version number this text was written on top of. A save is refused if the server has a newer one. */
  baseVersion: number
  status: EditorStatus
  /** When the last save (draft or version) succeeded, in ms. */
  savedAt: number | null
  /** The newer version the server holds, after a refused save. */
  conflict: SaveConflict | null
  /** The person's own earlier text, kept beside a newer version they chose to open. */
  shelved: string | null
}

export type EditorAction =
  | { type: 'typed'; text: string }
  | { type: 'draftSaving' }
  | { type: 'draftSaved'; text: string; at: number }
  | { type: 'versionSaving' }
  | { type: 'versionSaved'; text: string; version: number; at: number }
  | { type: 'failed'; reason: 'offline' | 'error' }
  | { type: 'conflicted'; conflict: SaveConflict }
  | { type: 'openTheirs' }
  | { type: 'saveMineOnTop' }
  | { type: 'decideLater' }
  | { type: 'replace'; text: string; baseVersion: number; at: number }
  | { type: 'appendShelved' }
  | { type: 'dropShelved' }

export function initialEditorState(init: { text: string; baseVersion: number; status?: EditorStatus; savedAt?: number | null }): EditorState {
  return {
    text: init.text,
    baseVersion: init.baseVersion,
    status: init.status ?? 'saved',
    savedAt: init.savedAt ?? null,
    conflict: null,
    shelved: null,
  }
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'typed':
      if (action.text === state.text) return state
      // Typing during a conflict keeps the conflict open: the person still has to decide.
      return { ...state, text: action.text, status: state.status === 'conflict' ? 'conflict' : 'dirty' }

    case 'draftSaving':
      return state.status === 'dirty' || state.status === 'offline' || state.status === 'error' ? { ...state, status: 'savingDraft' } : state

    case 'draftSaved':
      // Typing carried on while the draft was in flight: it is still dirty, and the next pause saves it again.
      if (action.text !== state.text) return state.status === 'savingDraft' ? { ...state, status: 'dirty' } : state
      return state.status === 'savingDraft' ? { ...state, status: 'draftSaved', savedAt: action.at } : state

    case 'versionSaving':
      return state.status === 'conflict' ? state : { ...state, status: 'savingVersion' }

    case 'versionSaved':
      return {
        ...state,
        baseVersion: action.version,
        status: action.text === state.text ? 'saved' : 'dirty',
        savedAt: action.at,
        conflict: null,
      }

    case 'failed':
      return state.status === 'savingDraft' || state.status === 'savingVersion' ? { ...state, status: action.reason } : state

    case 'conflicted':
      return { ...state, status: 'conflict', conflict: action.conflict }

    case 'openTheirs': {
      if (!state.conflict) return state
      return {
        ...state,
        shelved: state.text,
        text: state.conflict.current_content ?? '',
        baseVersion: state.conflict.current_version,
        status: 'saved',
        conflict: null,
      }
    }

    case 'saveMineOnTop':
      // Re-base on the newer version so the next save is accepted; the newer version stays in the history.
      return state.conflict ? { ...state, baseVersion: state.conflict.current_version, conflict: null, status: 'dirty' } : state

    case 'decideLater':
      return state.status === 'conflict' ? { ...state, status: 'dirty', conflict: null } : state

    case 'replace':
      return { ...state, text: action.text, baseVersion: action.baseVersion, status: 'saved', savedAt: action.at, conflict: null, shelved: null }

    case 'appendShelved':
      return state.shelved === null ? state : { ...state, text: `${state.text}\n\n${state.shelved}`, shelved: null, status: 'dirty' }

    case 'dropShelved':
      return { ...state, shelved: null }
  }
}

/** True while text exists that the server does not have as a version. */
export const hasUnsavedText = (s: EditorState) => s.status === 'dirty' || s.status === 'savingDraft' || s.status === 'draftSaved' || s.status === 'offline' || s.status === 'error' || s.status === 'conflict'
