import { useDeferredValue } from 'react'
import { renderMarkdown } from './markdown'
import styles from './Writing.module.css'

/** The rendered text. It lags a moment behind fast typing (a deferred value) so the editor never stutters. */
export function MarkdownPreview({ text, empty, headingOffset }: { text: string; empty: string; headingOffset?: number }) {
  const shown = useDeferredValue(text)
  if (!shown.trim()) return <p className={styles.hint}>{empty}</p>
  // renderMarkdown never emits raw HTML from the text (see markdown.ts), so this is safe to insert.
  return <div className={styles.preview} dangerouslySetInnerHTML={{ __html: renderMarkdown(shown, { headingOffset }) }} />
}
