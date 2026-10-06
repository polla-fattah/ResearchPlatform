import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { useProject } from '@/features/projects/useProject'
import styles from './Writing.module.css'

/**
 * Screen 34. Rich-text editing and Markdown editing would be two views of one document. Until the server confirms that
 * it keeps the citation markup and the per-block direction marks byte for byte (request file API-8 / C-18), switching
 * between them could silently change what a researcher wrote, so only the Markdown editor is offered. This page says so
 * and links to that editor for the same document.
 */
export function RichEditorPage() {
  const { t } = useTranslation()
  const { id } = useProject()
  const { documentId } = useParams()
  if (id === null) return null
  const back = documentId && /^\d+$/.test(documentId) ? `/projects/${id}/findings?doc=${documentId}` : `/projects/${id}/findings`
  return (
    <section aria-label={t('richEditor.title')}>
      <h1>{t('richEditor.title')}</h1>
      <div className={styles.empty}>
        <h2>{t('richEditor.unavailable.title')}</h2>
        <p>{t('richEditor.unavailable.body')}</p>
        <p>{t('richEditor.unavailable.markdown')}</p>
        <p>
          <Link to={back}>{t('richEditor.open')}</Link>
        </p>
      </div>
    </section>
  )
}
