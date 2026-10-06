import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listDocuments } from '@/api/documents'
import { listFindings } from '@/api/findings'
import { qk } from '@/api/queryKeys'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { StateBoundary } from '@/components/StateBoundary'
import { NewDocumentDialog } from './NewDocumentDialog'
import { findingCode } from './writingModel'
import styles from './Writing.module.css'

interface Props {
  projectId: number
  canEdit: boolean
  onOpenDocument: (id: number) => void
  onOpenFinding: (id: number | 'new') => void
}

/** The project's documents and findings side by side, and the two ways to start a new one. */
export function IndexView({ projectId, canEdit, onOpenDocument, onOpenFinding }: Props) {
  const { t } = useTranslation()
  const { n, relative } = usePreferences()
  const [newDoc, setNewDoc] = useState(false)

  const documents = useQuery({
    queryKey: qk.project(projectId).documents.list(),
    queryFn: ({ signal }) => listDocuments(projectId, undefined, signal),
  })
  const findings = useQuery({
    queryKey: qk.project(projectId).findings.list({}),
    queryFn: ({ signal }) => listFindings(projectId, {}, signal),
  })

  const docs = documents.data ?? []
  const finds = findings.data?.items ?? []
  const failed = documents.isError || findings.isError
  const loading = documents.isPending || findings.isPending
  const state = loading ? 'loading' : failed ? 'error' : docs.length + finds.length === 0 ? 'empty' : 'normal'
  const firstError = documents.isError ? documents : findings

  return (
    <section>
      <div className={styles.pageHead}>
        <div>
          <h1>{t('writing.title')}</h1>
          {state === 'normal' ? (
            <p className={styles.hint}>
              {t('writing.index.count', {
                documents: t('writing.index.documentsHeading', { count: n(docs.length) }),
                findings: t('writing.index.findingsHeading', { count: n(finds.length) }),
              })}
            </p>
          ) : null}
        </div>
        {canEdit ? (
          <div className={styles.docActions}>
            <Button onClick={() => onOpenFinding('new')}>{t('writing.newFinding')}</Button>
            <Button variant="primary" onClick={() => setNewDoc(true)}>
              {t('writing.newDocument')}
            </Button>
          </div>
        ) : null}
      </div>

      <StateBoundary
        state={state}
        errorValue={firstError.error}
        error={
          <div className={styles.banner} role="alert">
            <h2>{t('writing.loadFailed.title')}</h2>
            <p>{t('writing.loadFailed.body')}</p>
            <Button
              onClick={() => {
                void documents.refetch()
                void findings.refetch()
              }}
            >
              {t('common.retry')}
            </Button>
          </div>
        }
        empty={
          <div className={styles.empty}>
            <h2>{t('writing.index.empty.title')}</h2>
            <p>{t('writing.index.empty.body')}</p>
            {canEdit ? (
              <div className={styles.docActions}>
                <Button onClick={() => onOpenFinding('new')}>{t('writing.newFinding')}</Button>
                <Button variant="primary" onClick={() => setNewDoc(true)}>
                  {t('writing.newDocument')}
                </Button>
              </div>
            ) : null}
          </div>
        }
      >
        <div className={styles.indexGrid}>
          <section aria-label={t('writing.index.documentsHeading', { count: n(docs.length) })}>
            <h2 className={styles.paneTitle}>{t('writing.index.documentsHeading', { count: n(docs.length) })}</h2>
            {docs.length === 0 ? <p className={styles.hint}>{t('writing.index.noDocuments')}</p> : null}
            <ul className={styles.cards}>
              {docs.map((d) => (
                <li key={d.id}>
                  <button type="button" className={styles.card} onClick={() => onOpenDocument(d.id)}>
                    <strong className={styles.cardTitle}>
                      <BidiText>{d.title || t('writing.doc.untitled')}</BidiText>
                    </strong>
                    <span className={styles.hint}>
                      {d.latest_version
                        ? t('writing.index.documentMeta', {
                            version: d.latest_version.version_number,
                            author: d.latest_version.author?.display_name ?? '—',
                            when: d.updated_at ? relative(d.updated_at) : '',
                          })
                        : t('writing.index.documentMetaNoVersion')}
                    </span>
                    <span className={styles.badge}>{t(`writing.types.${d.document_type ?? 'article'}`, { defaultValue: d.document_type ?? '' })}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label={t('writing.index.findingsHeading', { count: n(finds.length) })}>
            <h2 className={styles.paneTitle}>{t('writing.index.findingsHeading', { count: n(finds.length) })}</h2>
            {finds.length === 0 ? <p className={styles.hint}>{t('writing.index.noFindings')}</p> : null}
            <ul className={styles.cards}>
              {finds.map((f) => {
                const count = f.evidence_items?.length ?? 0
                return (
                  <li key={f.id}>
                    <button type="button" className={styles.card} onClick={() => onOpenFinding(f.id)}>
                      <span className="mono">{findingCode(f.id)}</span>
                      <strong className={styles.cardTitle}>
                        <BidiText>{f.claim}</BidiText>
                      </strong>
                      <span className={styles.hint}>
                        {t('writing.index.findingMeta', {
                          evidence: t('writing.index.evidenceCount', { count, formattedCount: n(count) }),
                          when: f.updated_at ? relative(f.updated_at) : '',
                        })}
                      </span>
                      <span className={styles.badge}>{t(`writing.status.${f.status}`, { defaultValue: t('writing.status.unknown') })}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </StateBoundary>

      {newDoc ? (
        <NewDocumentDialog
          projectId={projectId}
          onClose={() => setNewDoc(false)}
          onCreated={(id) => {
            setNewDoc(false)
            onOpenDocument(id)
          }}
        />
      ) : null}
    </section>
  )
}
