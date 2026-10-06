import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { listDocuments } from '@/api/documents'
import { getProjectSummary } from '@/api/projectDetail'
import { qk } from '@/api/queryKeys'
import { listSubmissions } from '@/api/submissions'
import { NeutralState } from '@/components/Badges'
import { RefreshNotice } from '@/components/RefreshNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { ROLE_LABEL_KEYS } from '@/domain/roles'
import { useProject } from '@/features/projects/useProject'
import { PackageList } from './PackageList'
import { SubmissionForm } from './SubmissionForm'
import { latestOf, nextStep } from './submissionModel'
import styles from './Submission.module.css'

/**
 * Screen 21. The packages already submitted and, for the owner, the form for the next one when the workflow allows it
 * (the first, or an answer to a revision request). Everyone in the project can read the packages; only the owner can make one.
 */
export function SubmissionPage() {
  const { t } = useTranslation()
  const { id, project, role, can } = useProject()
  const projectId = id ?? 0
  const owner = can('submitFormal')

  const list = useQuery({ queryKey: qk.project(projectId).submission.list, queryFn: ({ signal }) => listSubmissions(projectId, signal), enabled: id !== null })
  const items = list.data ?? []
  const latest = latestOf(items)
  const step = nextStep(latest)
  // The documents and the findings count are needed only to build a package, which the workflow allows only now and then.
  const building = id !== null && owner && list.data !== undefined && (step === 'first' || step === 'respond')
  const documents = useQuery({ queryKey: qk.project(projectId).documents.list(), queryFn: ({ signal }) => listDocuments(projectId, undefined, signal), enabled: building })
  const summary = useQuery({ queryKey: qk.project(projectId).summary, queryFn: ({ signal }) => getProjectSummary(projectId, signal), enabled: building, retry: false })

  if (id === null || !project || !role) return null
  const view = list.data ? 'normal' : viewStateOf(list)

  return (
    <section>
      <h2>{t('submission.title')}</h2>
      {!owner ? (
        <p>
          <NeutralState kind="limitation">{t('submission.readOnly', { role: t(ROLE_LABEL_KEYS[role]) })}</NeutralState>
        </p>
      ) : null}

      <StateBoundary state={view} errorValue={list.error} onRetry={() => void list.refetch()}>
        <RefreshNotice query={list} what={t('submission.packages.title')} />

        {step === 'wait' ? <p role="status">{t('submission.next.wait')}</p> : null}
        {step === 'closed' ? <p role="status">{t(`submission.next.closed.${latest?.status === 'approved' ? 'approved' : 'rejected'}`)}</p> : null}

        {owner && (step === 'first' || step === 'respond') ? (
          documents.isPending ? (
            <p>{t('states.loading.label')}</p>
          ) : documents.isError ? (
            <p role="alert">{t('submission.form.documentsFailed')}</p>
          ) : (
            <SubmissionForm projectId={projectId} projectTitle={project.title} documents={documents.data ?? []} findingsCount={summary.data?.findings_count ?? null} latest={latest} />
          )
        ) : null}

        <div className={styles.section}>
          <h2>{t('submission.packages.title')}</h2>
          {items.length === 0 ? (
            <div className={styles.empty}>
              <h3>{t('submission.packages.noneTitle')}</h3>
              <p>{t('submission.packages.noneBody')}</p>
            </div>
          ) : (
            <PackageList items={items} />
          )}
          <p className={styles.hint}>{t('submission.packages.note')}</p>
        </div>
      </StateBoundary>
    </section>
  )
}
