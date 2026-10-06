import { useQuery } from '@tanstack/react-query'
import { Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getDocument, getDraft } from '@/api/documents'
import { listEvidence } from '@/api/evidence'
import { qk } from '@/api/queryKeys'
import { Button } from '@/components/Button'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { lazyNamed } from '@/app/lazy'
import { readLocalDraft } from './localDraft'
import { chooseStart } from './writingModel'
import styles from './Writing.module.css'

// The editor brings CodeMirror with it; the lists of documents and findings do not need it, so it is fetched when a document opens.
const DocumentEditor = lazyNamed(() => import('./DocumentEditor'), 'DocumentEditor')

interface Props {
  projectId: number
  id: number
  canEdit: boolean
  showVersions: boolean
  onVersions: (show: boolean) => void
  onBack: () => void
  onOpenFinding: (id: number) => void
}

/**
 * Loads what the editor needs (the document, this person's draft, the project's evidence) and decides what text it
 * opens with. The editor itself is mounted only once all of it is here, so its starting text is fixed from the first
 * render and nothing has to be copied into state afterwards.
 */
export function DocumentView({ projectId, id, canEdit, showVersions, onVersions, onBack, onOpenFinding }: Props) {
  const { t } = useTranslation()
  // Text kept in this browser from an offline session, read once when the document opens.
  const [local] = useState(() => readLocalDraft(projectId, id))

  const doc = useQuery({
    queryKey: qk.project(projectId).documents.detail(id),
    queryFn: ({ signal }) => getDocument(projectId, id, signal),
    retry: false,
  })
  const draft = useQuery({
    queryKey: qk.project(projectId).documents.draft(id),
    queryFn: ({ signal }) => getDraft(projectId, id, signal),
    enabled: canEdit && doc.isSuccess,
    retry: false,
    // A draft is what was true when the document opened; refetching it later must not change the starting text.
    staleTime: Infinity,
    gcTime: 0,
  })
  const evidence = useQuery({
    queryKey: qk.project(projectId).evidence.list({ per_page: 100 }),
    queryFn: ({ signal }) => listEvidence(projectId, { per_page: 100 }, signal),
  })

  const head = doc.data?.latest_version
  const waiting = doc.isPending || (canEdit && doc.isSuccess && draft.isPending)
  const state = waiting ? 'loading' : viewStateOf(doc)

  return (
    <StateBoundary
      state={state}
      errorValue={doc.error}
      onRetry={() => void doc.refetch()}
      forbidden={
        <div className={styles.notice} role="status">
          <h1>{t('writing.unavailable.title')}</h1>
          <p>{t('writing.unavailable.body')}</p>
          <Button onClick={onBack}>{t('writing.back')}</Button>
        </div>
      }
    >
      {doc.data && head ? (
        <Suspense fallback={<p role="status">{t('states.loading.label')}</p>}>
          <DocumentEditor
            key={doc.data.id}
            projectId={projectId}
            doc={doc.data}
            start={chooseStart(head, draft.data ?? null, local)}
            evidence={evidence.data?.items ?? []}
            canEdit={canEdit}
            showVersions={showVersions}
            onVersions={onVersions}
            onBack={onBack}
            onOpenFinding={onOpenFinding}
            onDeleted={onBack}
          />
        </Suspense>
      ) : null}
    </StateBoundary>
  )
}
