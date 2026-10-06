import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { acceptInvitation, declineInvitation, getInvitation } from '@/api/members'
import { invalidate } from '@/api/invalidate'
import { qk } from '@/api/queryKeys'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { MutationNotice } from '@/components/MutationNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { formatCode } from '@/domain/codes'
import { normalizeRole } from '@/domain/roles'
import { ROLES, roleMatrix } from './membersModel'
import styles from './Members.module.css'

/**
 * The page behind an invitation link. It shows only what the invitation itself carries (project title, who invited,
 * the role) and what that role may and may not do; the project's research is shown after accepting. Signing in first
 * is the route guard's job, and it brings the person back here.
 */
export function InvitationPage() {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const { token = '' } = useParams()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const query = useQuery({ queryKey: qk.invitation(token), queryFn: ({ signal }) => getInvitation(token, signal), retry: false })
  const accept = useMutation({
    mutationFn: () => acceptInvitation(token),
    onSuccess: async () => {
      await invalidate.invitationAnswered(qc, token)
      navigate(`/projects/${query.data?.project_id}/overview`, { replace: true })
    },
  })
  const decline = useMutation({ mutationFn: () => declineInvitation(token), onSuccess: () => invalidate.invitationAnswered(qc, token) })

  const inv = query.data
  const role = normalizeRole(inv?.role)
  const open = inv ? inv.status === 'pending' && !inv.is_expired : false
  const matrix = role ? roleMatrix().map((r) => ({ action: r.action, ok: r.allowed[ROLES.indexOf(role)] === true })) : []

  return (
    <StateBoundary
      state={viewStateOf(query)}
      errorValue={query.error}
      onRetry={() => void query.refetch()}
      forbidden={
        <div className={styles.card}>
          <h1>{t('members.invitation.unavailableTitle')}</h1>
          <p>{t('members.invitation.unavailableBody')}</p>
          <Link to="/home">{t('members.invitation.home')}</Link>
        </div>
      }
    >
      {inv ? (
        <div className={styles.card}>
          <p className={styles.muted}>
            {inv.expires_at ? t('members.invitation.expires', { date: date(inv.expires_at) }) : null}
          </p>
          <h1>{t('members.invitation.title', { name: inv.inviter ?? t('members.theOwner') })}</h1>
          <dl>
            <dt>{t('members.invitation.project')}</dt>
            <dd>
              <BidiText>{inv.project_title ?? formatCode('PRJ', inv.project_id)}</BidiText>
            </dd>
            <dt>{t('members.table.role')}</dt>
            <dd>{role ? t(`roles.${role}`) : inv.role}</dd>
          </dl>

          {open && role ? (
            <>
              <h2>{t('members.invitation.can', { role: t(`roles.${role}`) })}</h2>
              <ul>
                {matrix.filter((m) => m.ok).map((m) => (
                  <li key={m.action}>{t(`members.matrix.actions.${m.action}`)}</li>
                ))}
              </ul>
              <h2>{t('members.invitation.cannot')}</h2>
              <ul>
                {matrix.filter((m) => !m.ok).map((m) => (
                  <li key={m.action}>{t(`members.matrix.actions.${m.action}`)}</li>
                ))}
              </ul>
              <p className={styles.muted}>{t('members.invitation.shows')}</p>
              <MutationNotice error={accept.error ?? decline.error} title={t('members.invitation.failed')} />
              {decline.isSuccess ? (
                <p role="status">{t('members.invitation.declined')}</p>
              ) : (
                <div className={styles.actions}>
                  <Button variant="primary" onClick={() => accept.mutate()} disabled={accept.isPending || decline.isPending}>
                    {t('members.invitation.accept')}
                  </Button>
                  <Button onClick={() => decline.mutate()} disabled={accept.isPending || decline.isPending}>
                    {t('members.invitation.decline')}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p role="status">{t(`members.invitation.closed.${inv.status === 'pending' ? 'expired' : inv.status}`, { defaultValue: t('members.invitation.closed.other') })}</p>
          )}
        </div>
      ) : null}
    </StateBoundary>
  )
}
