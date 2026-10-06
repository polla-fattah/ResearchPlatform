import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listVersions, restoreVersion } from '@/api/documents'
import { invalidate } from '@/api/invalidate'
import { qk } from '@/api/queryKeys'
import type { DocumentVersion } from '@/api/schemas/writing'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { MutationNotice } from '@/components/MutationNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { diffLines, hasChanges } from './diff'
import { MarkdownPreview } from './MarkdownPreview'
import styles from './Writing.module.css'

interface Props {
  projectId: number
  documentId: number
  title: string
  canEdit: boolean
  onBack: () => void
  /** The server made a new head version out of an old one: the editor should show it. */
  onRestored: (version: DocumentVersion) => void
}

/**
 * Every version of one document with its author, the text of any of them, a line-by-line comparison with the newest,
 * and restore (which adds a new version and deletes nothing).
 */
export function VersionsView({ projectId, documentId, title, canEdit, onBack, onRestored }: Props) {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const qc = useQueryClient()
  const [picked, setPicked] = useState<number | null>(null)
  const [comparing, setComparing] = useState(false)

  const list = useQuery({
    queryKey: qk.project(projectId).documents.versions(documentId),
    queryFn: ({ signal }) => listVersions(projectId, documentId, signal),
  })
  const versions = [...(list.data ?? [])].sort((a, b) => b.version_number - a.version_number)
  const newest = versions[0]
  const selected = versions.find((v) => v.version_number === picked) ?? newest

  const restore = useMutation({
    mutationFn: (v: number) => restoreVersion(projectId, documentId, v),
    onSuccess: async (restored) => {
      // The version list is part of the document's data, so this refreshes it too.
      await invalidate.documentsChanged(qc, projectId)
      setPicked(null)
      setComparing(false)
      onRestored(restored)
    },
  })

  const state = viewStateOf(list, { isEmpty: (d) => (d as unknown[]).length === 0 })
  const lines = selected && newest && comparing ? diffLines(selected.content, newest.content) : null
  const isNewest = selected?.version_number === newest?.version_number

  return (
    <section aria-label={t('writing.versions.title')}>
      <Button variant="ghost" onClick={onBack}>
        {t('writing.versions.back', { title })}
      </Button>
      <h2 className={styles.viewTitle}>{t('writing.versions.title')}</h2>

      <StateBoundary
        state={state}
        errorValue={list.error}
        onRetry={() => void list.refetch()}
        empty={<p className={styles.hint}>{t('writing.versions.empty')}</p>}
      >
        <div className={styles.versionsLayout}>
          <ol className={styles.versionList}>
            {versions.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  className={[styles.versionRow, v.version_number === selected?.version_number ? styles.versionRowOn : ''].join(' ')}
                  aria-current={v.version_number === selected?.version_number ? 'true' : undefined}
                  onClick={() => {
                    setPicked(v.version_number)
                    setComparing(false)
                  }}
                >
                  <strong>
                    {t('writing.versions.row', {
                      version: v.version_number,
                      author: v.author?.display_name ?? '—',
                      when: v.created_at ? date(v.created_at, { time: true }) : '',
                    })}
                  </strong>
                  {v.version_number === newest?.version_number ? <span className={styles.badge}>{t('writing.versions.current')}</span> : null}
                  {v.change_summary ? <span className={styles.hint}>{v.change_summary}</span> : null}
                </button>
              </li>
            ))}
          </ol>

          {selected ? (
            <div className={styles.versionDetail}>
              <div className={styles.versionBar}>
                <h3>{t('writing.versions.viewing', { version: selected.version_number })}</h3>
                {!isNewest ? (
                  <Button onClick={() => setComparing((c) => !c)} aria-pressed={comparing}>
                    {t('writing.versions.compare')}
                  </Button>
                ) : null}
              </div>

              {lines ? (
                <>
                  <p className={styles.hint}>{t('writing.versions.comparing', { from: selected.version_number, to: newest!.version_number })}</p>
                  {hasChanges(lines) ? (
                    <ol className={styles.diff} aria-label={t('writing.versions.comparing', { from: selected.version_number, to: newest!.version_number })}>
                      {lines.map((l, i) => (
                        <li key={i} className={styles[`diff_${l.type}`]}>
                          <span aria-hidden="true">{l.type === 'add' ? '+' : l.type === 'del' ? '−' : ' '}</span>
                          <span className={styles.srOnly}>{l.type === 'add' ? t('writing.versions.added') : l.type === 'del' ? t('writing.versions.removed') : ''}</span>
                          <BidiText>{l.text || ' '}</BidiText>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className={styles.hint}>{t('writing.versions.same')}</p>
                  )}
                </>
              ) : (
                <MarkdownPreview text={selected.content} empty={t('writing.doc.previewEmpty')} />
              )}

              {selected.citations && selected.citations.length > 0 ? (
                <section>
                  <h4>{t('writing.versions.citationsIn')}</h4>
                  <ul className={styles.plain}>
                    {selected.citations.map((c, i) => (
                      <li key={c.id ?? i}>
                        <BidiText>{c.formatted_citation}</BidiText>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {canEdit && !isNewest && newest ? (
                <div className={styles.restore}>
                  <Button variant="primary" disabled={restore.isPending} onClick={() => restore.mutate(selected.version_number)}>
                    {t('writing.versions.restore', { from: selected.version_number, to: newest.version_number + 1 })}
                  </Button>
                  <p className={styles.hint}>{t('writing.versions.restoreNote', { from: selected.version_number, to: newest.version_number + 1 })}</p>
                </div>
              ) : null}
              <MutationNotice error={restore.error} title={t('writing.versions.restoreFailed')} />
            </div>
          ) : null}
        </div>
      </StateBoundary>
    </section>
  )
}
