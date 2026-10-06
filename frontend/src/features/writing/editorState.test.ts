import { describe, expect, it } from 'vitest'
import { editorReducer, hasUnsavedText, initialEditorState, type EditorAction, type EditorState } from './editorState'

const start = (over: Partial<EditorState> = {}): EditorState => ({ ...initialEditorState({ text: 'v1', baseVersion: 1 }), ...over })
const run = (state: EditorState, ...actions: EditorAction[]) => actions.reduce(editorReducer, state)

describe('document editor state machine', () => {
  it('starts saved on the version it was opened from', () => {
    expect(start()).toMatchObject({ text: 'v1', baseVersion: 1, status: 'saved', conflict: null, shelved: null })
  })

  it('typing makes it dirty, and typing the same text again changes nothing', () => {
    const s = run(start(), { type: 'typed', text: 'v1 more' })
    expect(s.status).toBe('dirty')
    expect(editorReducer(s, { type: 'typed', text: 'v1 more' })).toBe(s)
  })

  it('autosaves a draft: dirty → savingDraft → draftSaved', () => {
    const s = run(start(), { type: 'typed', text: 'a' }, { type: 'draftSaving' }, { type: 'draftSaved', text: 'a', at: 10 })
    expect(s).toMatchObject({ status: 'draftSaved', savedAt: 10, baseVersion: 1 })
  })

  it('stays dirty when more was typed while the draft was being saved', () => {
    const s = run(start(), { type: 'typed', text: 'a' }, { type: 'draftSaving' }, { type: 'typed', text: 'ab' }, { type: 'draftSaved', text: 'a', at: 10 })
    expect(s.status).toBe('dirty')
    expect(s.text).toBe('ab')
  })

  it('a draft that failed because the network is down is offline, and a retry goes back to saving', () => {
    const offline = run(start(), { type: 'typed', text: 'a' }, { type: 'draftSaving' }, { type: 'failed', reason: 'offline' })
    expect(offline.status).toBe('offline')
    expect(offline.text).toBe('a')
    expect(editorReducer(offline, { type: 'draftSaving' }).status).toBe('savingDraft')
  })

  it('an unexpected failure is an error, and the text is still there', () => {
    const s = run(start(), { type: 'typed', text: 'a' }, { type: 'draftSaving' }, { type: 'failed', reason: 'error' })
    expect(s).toMatchObject({ status: 'error', text: 'a' })
  })

  it('ignores a failure that arrives when nothing was being saved', () => {
    const s = start()
    expect(editorReducer(s, { type: 'failed', reason: 'offline' })).toBe(s)
  })

  it('saving a version moves the base to the new version number', () => {
    const s = run(start(), { type: 'typed', text: 'v2' }, { type: 'versionSaving' }, { type: 'versionSaved', text: 'v2', version: 2, at: 5 })
    expect(s).toMatchObject({ status: 'saved', baseVersion: 2, savedAt: 5 })
  })

  it('stays dirty when more was typed while the version was being saved', () => {
    const s = run(start(), { type: 'typed', text: 'v2' }, { type: 'versionSaving' }, { type: 'typed', text: 'v2!' }, { type: 'versionSaved', text: 'v2', version: 2, at: 5 })
    expect(s).toMatchObject({ status: 'dirty', baseVersion: 2, text: 'v2!' })
  })

  describe('a refused save (conflict)', () => {
    const conflict = { current_version: 3, current_content: 'their text', current_author: 'Aras', saved_at: '2026-10-06T11:51:00Z' }
    const conflicted = () => run(start({ baseVersion: 2 }), { type: 'typed', text: 'my text' }, { type: 'versionSaving' }, { type: 'conflicted', conflict })

    it('keeps my text and records the newer version', () => {
      expect(conflicted()).toMatchObject({ status: 'conflict', text: 'my text', baseVersion: 2, conflict })
    })

    it('typing while the conflict is open does not hide it', () => {
      const s = editorReducer(conflicted(), { type: 'typed', text: 'my text!' })
      expect(s.status).toBe('conflict')
      expect(s.text).toBe('my text!')
    })

    it('"open theirs" loads their text on their version and shelves mine, so nothing is lost', () => {
      const s = editorReducer(conflicted(), { type: 'openTheirs' })
      expect(s).toMatchObject({ text: 'their text', baseVersion: 3, status: 'saved', conflict: null, shelved: 'my text' })
    })

    it('shelved text can be added to the end, or dropped', () => {
      const opened = editorReducer(conflicted(), { type: 'openTheirs' })
      expect(editorReducer(opened, { type: 'appendShelved' })).toMatchObject({ text: 'their text\n\nmy text', shelved: null, status: 'dirty' })
      expect(editorReducer(opened, { type: 'dropShelved' }).shelved).toBeNull()
    })

    it('"save mine on top" re-bases my text on their version so the next save is accepted', () => {
      const s = editorReducer(conflicted(), { type: 'saveMineOnTop' })
      expect(s).toMatchObject({ text: 'my text', baseVersion: 3, status: 'dirty', conflict: null })
    })

    it('"decide later" closes the dialog without losing anything or changing the base', () => {
      const s = editorReducer(conflicted(), { type: 'decideLater' })
      expect(s).toMatchObject({ text: 'my text', baseVersion: 2, status: 'dirty', conflict: null })
    })

    it('does nothing for conflict actions when there is no conflict', () => {
      const s = start()
      expect(editorReducer(s, { type: 'openTheirs' })).toBe(s)
      expect(editorReducer(s, { type: 'saveMineOnTop' })).toBe(s)
    })
  })

  it('replace (after restoring a version) swaps the text and base and clears everything pending', () => {
    const s = run(start({ shelved: 'old' }), { type: 'typed', text: 'x' }, { type: 'replace', text: 'restored', baseVersion: 4, at: 9 })
    expect(s).toMatchObject({ text: 'restored', baseVersion: 4, status: 'saved', shelved: null, savedAt: 9 })
  })

  it('knows when there is text the server does not have as a version', () => {
    expect(hasUnsavedText(start())).toBe(false)
    expect(hasUnsavedText(run(start(), { type: 'typed', text: 'a' }))).toBe(true)
    expect(hasUnsavedText(run(start(), { type: 'typed', text: 'a' }, { type: 'draftSaving' }, { type: 'draftSaved', text: 'a', at: 1 }))).toBe(true)
    expect(hasUnsavedText(run(start(), { type: 'typed', text: 'a' }, { type: 'versionSaving' }, { type: 'versionSaved', text: 'a', version: 2, at: 1 }))).toBe(false)
  })
})
