import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listInvitations, listMembers } from '@/api/members'
import { qk } from '@/api/queryKeys'
import { useAuth } from '@/app/authContext'
import { usePreferences } from '@/app/preferencesContext'
import { Button } from '@/components/Button'
import { NeutralState } from '@/components/Badges'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { ROLE_LABEL_KEYS } from '@/domain/roles'
import { useProject } from '@/features/projects/useProject'
import { InvitationsPanel } from './InvitationsPanel'
import { InviteDialog } from './InviteDialog'
import { ChangeRoleDialog, LeaveDialog, RemoveDialog } from './MemberDialogs'
import { MembersTable } from './MembersTable'
import { memberRows, type MemberRow } from './membersModel'
import { RoleMatrix } from './RoleMatrix'
import styles from './Members.module.css'

type Dialog = { kind: 'invite' } | { kind: 'role'; row: MemberRow } | { kind: 'remove'; row: MemberRow } | { kind: 'leave' } | null

/**
 * Screen 15. The members and invitations are server data in two queries; the only local state is which dialog is open
 * (each dialog owns its own draft and unmounts with it). What a person may do follows their role through `can`.
 */
export function MembersPage() {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const { user } = useAuth()
  const { id, project, role, can } = useProject()
  const [dialog, setDialog] = useState<Dialog>(null)
  const manage = can('manageMembers')

  const members = useQuery({
    queryKey: qk.project(id ?? 0).members.list,
    queryFn: ({ signal }) => listMembers(id!, signal),
    enabled: id !== null,
  })
  const invitations = useQuery({
    queryKey: qk.project(id ?? 0).members.invitations,
    queryFn: ({ signal }) => listInvitations(id!, 1, signal),
    enabled: id !== null && manage,
    retry: false,
  })

  if (id === null || !project || !role) return null
  const owner = { id: project.owner_id, name: project.owner?.display_name ?? null }
  const rows = members.data ? memberRows(members.data, owner) : []
  // A failed refresh keeps the people already shown (state rule S1) and says so above them.
  const state = members.data ? 'normal' : viewStateOf(members)
  const alone = rows.length <= 1

  return (
    <section>
      <div className={styles.head}>
        <div>
          <h2>{t('members.title')}</h2>
          <p className={styles.sub}>{members.data ? t('members.count', { count: rows.length, formattedCount: n(rows.length) }) : null}</p>
        </div>
        {manage ? (
          <Button variant="primary" onClick={() => setDialog({ kind: 'invite' })}>
            {t('members.invite.open')}
          </Button>
        ) : null}
      </div>

      {!manage ? (
        <p>
          <NeutralState kind="limitation">
            {t('members.readOnly', { role: t(ROLE_LABEL_KEYS[role]), owner: owner.name ?? t('members.theOwner') })}
          </NeutralState>
        </p>
      ) : null}

      <div className={styles.section}>
        {members.isError && members.data ? (
          <div role="alert" className={styles.empty}>
            <p>{t('members.refreshFailed')}</p>
            <Button onClick={() => void members.refetch()}>{t('common.retry')}</Button>
          </div>
        ) : null}
        <StateBoundary state={state} errorValue={members.error} onRetry={() => void members.refetch()}>
          {alone && manage ? (
            <div className={styles.empty}>
              <h3>{t('members.empty.title')}</h3>
              <p>{t('members.empty.body')}</p>
              <Button variant="primary" onClick={() => setDialog({ kind: 'invite' })}>
                {t('members.empty.action')}
              </Button>
            </div>
          ) : null}
          <MembersTable
            rows={rows}
            meId={user?.id ?? null}
            canManage={manage}
            onChangeRole={(row) => setDialog({ kind: 'role', row })}
            onRemove={(row) => setDialog({ kind: 'remove', row })}
            onLeave={() => setDialog({ kind: 'leave' })}
          />
        </StateBoundary>
      </div>

      {manage ? (
        <div className={styles.section}>
          <h3>{t('members.invitations.title')}</h3>
          <InvitationsPanel projectId={id} query={invitations} />
          <p className={styles.muted}>
            <NeutralState kind="limitation">{t('members.transferUnavailable')}</NeutralState>
          </p>
        </div>
      ) : null}

      <div className={styles.section}>
        <h3>{t('members.matrix.title')}</h3>
        <RoleMatrix />
      </div>

      {dialog?.kind === 'invite' ? <InviteDialog projectId={id} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === 'role' ? <ChangeRoleDialog projectId={id} row={dialog.row} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === 'remove' ? (
        <RemoveDialog
          projectId={id}
          row={dialog.row}
          onClose={() => setDialog(null)}
          onChangeInstead={() => setDialog({ kind: 'role', row: dialog.row })}
        />
      ) : null}
      {dialog?.kind === 'leave' ? <LeaveDialog projectId={id} onClose={() => setDialog(null)} /> : null}
    </section>
  )
}
