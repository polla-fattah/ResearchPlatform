import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { declineCollaborationRequest, listCollaborationRequests } from '@/api/collaboration'
import { invalidate } from '@/api/invalidate'
import { qk } from '@/api/queryKeys'
import type { CollaborationRequest } from '@/api/schemas/collaboration'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { MutationNotice } from '@/components/MutationNotice'
import { RefreshNotice } from '@/components/RefreshNotice'
import dialog from '@/components/Dialog.module.css'
import { InviteDialog } from './InviteDialog'
import styles from './Members.module.css'

/**
 * The people who asked, from the project's public announcement. Owner only. Accepting is an invitation by e-mail (the
 * person answers it); declining records the decision. Nothing here adds anyone to the project.
 */
export function CollaborationRequestsPanel({ projectId }: { projectId: number }) {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const [action, setAction] = useState<{ kind: 'invite' | 'decline'; request: CollaborationRequest } | null>(null)
  const query = useQuery({
    queryKey: qk.project(projectId).members.requests,
    queryFn: ({ signal }) => listCollaborationRequests(projectId, signal),
    retry: false,
  })

  if (query.isPending) return <p className={styles.muted}>{t('states.loading.label')}</p>
  if (query.isError && !query.data) {
    return (
      <div role="alert" className={styles.empty}>
        <p>{t('members.requests.failed')}</p>
        <Button onClick={() => void query.refetch()}>{t('common.retry')}</Button>
      </div>
    )
  }
  const items = query.data ?? []

  return (
    <>
      <RefreshNotice query={query} what={t('members.requests.title')} />
      {items.length === 0 ? <p className={styles.muted}>{t('members.requests.none')}</p> : null}
      <ul className={styles.requests} aria-label={t('members.requests.title')}>
        {items.map((r) => (
          <li key={r.id} className={styles.request}>
            <div>
              <strong>
                <BidiText>{r.requester?.display_name ?? r.contact_email ?? t('members.requests.someone')}</BidiText>
              </strong>{' '}
              <span className={styles.state}>{t(`members.requests.states.${r.status}`, { defaultValue: r.status })}</span>
              {r.created_at ? <span className={styles.muted}> · {date(r.created_at)}</span> : null}
              {r.contact_email ? <div className={styles.muted}>{r.contact_email}</div> : null}
              <p className={styles.message}>
                <BidiText>{r.message}</BidiText>
              </p>
              {r.decision_notes ? (
                <p className={styles.muted}>
                  {t('members.requests.notes')}: <BidiText>{r.decision_notes}</BidiText>
                </p>
              ) : null}
            </div>
            {r.status === 'pending' ? (
              <div className={styles.actions}>
                {r.contact_email ? (
                  <Button variant="primary" onClick={() => setAction({ kind: 'invite', request: r })}>
                    {t('members.requests.invite')}
                  </Button>
                ) : null}
                <Button onClick={() => setAction({ kind: 'decline', request: r })}>{t('members.requests.decline')}</Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <p className={styles.muted}>{t('members.requests.note')}</p>
      {action?.kind === 'invite' ? <InviteDialog projectId={projectId} initialEmail={action.request.contact_email ?? ''} onClose={() => setAction(null)} /> : null}
      {action?.kind === 'decline' ? <DeclineDialog projectId={projectId} request={action.request} onClose={() => setAction(null)} /> : null}
    </>
  )
}

function DeclineDialog({ projectId, request, onClose }: { projectId: number; request: CollaborationRequest; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [notes, setNotes] = useState('')
  const decline = useMutation({
    mutationFn: () => declineCollaborationRequest(projectId, request.id, notes.trim()),
    onSuccess: async () => {
      await invalidate.collaborationRequestsChanged(qc, projectId)
      onClose()
    },
  })
  return (
    <Modal title={t('members.requests.declineTitle', { name: request.requester?.display_name ?? request.contact_email ?? t('members.requests.someone') })} onClose={onClose}>
      <p>{t('members.requests.declineBody')}</p>
      <Field label={t('members.requests.declineNotes')} requirement="optional" hint={t('members.requests.declineNotesHint')}>
        <textarea rows={3} dir="auto" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <MutationNotice error={decline.error} title={t('members.requests.declineFailed')} />
      <div className={dialog.actions}>
        <Button onClick={onClose} disabled={decline.isPending}>
          {t('common.cancel')}
        </Button>
        <Button variant="danger" onClick={() => decline.mutate()} disabled={decline.isPending}>
          {t('members.requests.decline')}
        </Button>
      </div>
    </Modal>
  )
}
