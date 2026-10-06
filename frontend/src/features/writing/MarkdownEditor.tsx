import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap, placeholder as placeholderExtension } from '@codemirror/view'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import styles from './Writing.module.css'

export interface EditorHandle {
  /** Replaces the selection (or inserts at the cursor) and keeps the cursor after the new text. */
  insertAtCursor: (text: string) => void
  focus: () => void
}

interface Props {
  value: string
  onChange: (text: string) => void
  readOnly: boolean
  /** Spoken name of the editing area. */
  label: string
  placeholder: string
}

/**
 * The Markdown source editor (CodeMirror 6). The text is owned by the parent: this component shows `value` and reports
 * typing through `onChange`, and only touches the document when `value` differs from what the editor already holds
 * (a restored version, an opened newer version), so typing never fights the parent for the cursor.
 *
 * Each line takes its own direction (`perLineTextDirection`), so Arabic, Sorani and English lines in one document
 * each run the right way; the preview does the same for blocks.
 */
export const MarkdownEditor = forwardRef<EditorHandle, Props>(function MarkdownEditor(
  { value, onChange, readOnly, label, placeholder },
  ref,
) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const editable = useRef(new Compartment())
  const report = useRef(onChange)
  useEffect(() => {
    report.current = onChange
  }, [onChange])

  // What the editor starts with. Later changes arrive through the effects below, so the editor is built only once.
  const initial = useRef({ value, label, placeholder, readOnly })

  // Create the editor once.
  useEffect(() => {
    if (!host.current) return
    const start = initial.current
    const created = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: start.value,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown(),
          EditorView.lineWrapping,
          EditorView.perLineTextDirection.of(true),
          EditorView.contentAttributes.of({ 'aria-label': start.label, 'aria-multiline': 'true' }),
          placeholderExtension(start.placeholder),
          editable.current.of([EditorState.readOnly.of(start.readOnly), EditorView.editable.of(!start.readOnly)]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) report.current(update.state.doc.toString())
          }),
        ],
      }),
    })
    view.current = created
    return () => {
      created.destroy()
      view.current = null
    }
  }, [])

  // A different text from outside (restore, open the newer version).
  useEffect(() => {
    const v = view.current
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } })
  }, [value])

  useEffect(() => {
    view.current?.dispatch({
      effects: editable.current.reconfigure([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
    })
  }, [readOnly])

  useImperativeHandle(ref, () => ({
    insertAtCursor: (text) => {
      const v = view.current
      if (!v) return
      v.dispatch(v.state.replaceSelection(text))
      v.focus()
    },
    focus: () => view.current?.focus(),
  }))

  return <div ref={host} className={styles.editor} data-testid="markdown-editor" />
})
