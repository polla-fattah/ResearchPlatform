import { useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { invalidate } from '@/api/invalidate'
import { resendInvitation, withdrawInvitation } from '@/api/members'
import type { Invitation } from '@/api/schemas/members'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { ConfirmAction } from '@/components/ConfirmAction'
import { MutationNotice } from '@/components/MutationNotice'
import { CopyLink } from './CopyLink'
import { invitationLink, invitationState, openInvitations } from './membersModel'
import styles from './Members.module.css'

type Result = UseQueryResult<{ items: Invitation[] }>

/**
 * Invitations that have not become members: waiting, expired or declined. Owner only (the server refuses others).
 * "Expired" is judged against the moment the list was loaded, never the clock in render.
 */
export function InvitationsPanel({ projectId, query }: { projectId: number; query: Result }) {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const qc = useQueryClient()
  const [withdrawing, setWithdrawing] = useState<Invitation | null>(null)

  const resend = useMutation({
    mutationFn: (id: number) => resendInvitation(projectId, id),
    onSuccess: () => invalidate.membersChanged(qc, projectId),
  })
  const withdraw = useMutation({
    mutationFn: (id: number) => withdrawInvitation(projectId, id),
    onSuccess: async () => {
      await invalidate.membersChanged(qc, projectId)
      setWithdrawing(null)
    },
  })

  if (query.isPending) return <p className={styles.muted}>{t('states.loading.label')}</p>
  if (query.isError && !query.data) {
    return (
      <div role="alert" className={styles.empty}>
        <p>{t('members.invitations.failed')}</p>
        <Button onClick={() => void query.refetch()}>{t('common.retry')}</Button>
      </div>
    )
  }
  const items = openInvitations(query.data?.items ?? [])
  if (items.length === 0) return <p className={styles.muted}>{t('members.invitations.none')}</p>

  const asOf = query.dataUpdatedAt
  return (
    <>
      <MutationNotice error={resend.error} title={t('members.invitations.resendFailed')} />
      <table className={styles.table} aria-label={t('members.invitations.title')}>
        <thead>
          <tr>
            <th scope="col">{t('members.invite.email')}</th>
            <th scope="col">{t('members.table.role')}</th>
            <th scope="col">{t('members.invitations.state')}</th>
            <th scope="col">{t('members.invitations.link')}</th>
            <th scope="col">
              <span className="sr-only">{t('members.table.actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((inv) => {
            const state = invitationState(inv, asOf)
            return (
              <tr key={inv.id}>
                <th scope="row">
                  <BidiText>{inv.email}</BidiText>
                </th>
                <td>{t(`roles.${inv.role}`, { defaultValue: inv.role })}</td>
                <td className={styles.state}>
                  <span className={state === 'expired' ? styles.expired : undefined}>{t(`members.invitations.states.${state}`)}</span>
                  {inv.expires_at ? <div className={styles.muted}>{t('members.invitations.expires', { date: date(inv.expires_at) })}</div> : null}
                </td>
                <td>
                  {state === 'waiting' && inv.token ? (
                    <CopyLink link={invitationLink(window.location.origin, inv.token)} />
                  ) : (
                    <span className={styles.muted}>{t('members.invitations.sendAgain')}</span>
                  )}
                </td>
                <td>
                  <div className={styles.actions}>
                    <Button onClick={() => resend.mutate(inv.id)} disabled={resend.isPending}>
                      {t('members.invitations.resend')}
                    </Button>
                    <Button variant="danger" onClick={() => setWithdrawing(inv)}>
                      {t('members.invitations.withdraw')}
                    </Button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {withdrawing ? (
        <ConfirmAction
          open
          danger
          busy={withdraw.isPending}
          title={t('members.invitations.withdrawTitle', { email: withdrawing.email })}
          confirmLabel={t('members.invitations.withdraw')}
          onConfirm={() => withdraw.mutate(withdrawing.id)}
          onCancel={() => setWithdrawing(null)}
        >
          <p>{t('members.invitations.withdrawBody')}</p>
          <MutationNotice error={withdraw.error} title={t('members.invitations.withdrawFailed')} />
        </ConfirmAction>
      ) : null}
    </>
  )
}
