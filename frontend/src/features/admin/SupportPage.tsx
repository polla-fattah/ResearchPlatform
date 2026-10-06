import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listSupportGrants, revokeSupportGrant } from '@/api/admin'
import { invalidate } from '@/api/invalidate'
import { qk } from '@/api/queryKeys'
import type { SupportGrant } from '@/api/schemas/admin'
import { useAuth } from '@/app/authContext'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { ConfirmAction } from '@/components/ConfirmAction'
import { MutationNotice } from '@/components/MutationNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { formatCode } from '@/domain/codes'
import { useNow } from '@/hooks/useNow'
import { AdminHead } from './AdminHead'
import { accountCode, grantState } from './adminModel'
import styles from './Admin.module.css'

/**
 * Screen 13, Support access. A researcher gives an administrator time-limited, read-only access to one project or
 * document from their own settings; this view lists those grants and lets the administrator give one back early.
 * Nothing here opens the project: ordinary admin search never shows private research (conventions §support).
 */
export function SupportPage() {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const { user: me } = useAuth()
  const qc = useQueryClient()
  const now = useNow()
  const [revoking, setRevoking] = useState<number | null>(null)

  const grants = useQuery({ queryKey: qk.admin.grants, queryFn: ({ signal }) => listSupportGrants(signal) })
  const revoke = useMutation({
    mutationFn: (id: number) => revokeSupportGrant(id),
    onSuccess: async () => {
      setRevoking(null)
      await invalidate.adminGrantsChanged(qc)
    },
    onError: () => setRevoking(null),
  })

  const objectLabel = (g: SupportGrant) => (g.scope === 'project' ? formatCode('PRJ', g.object_id) : t('admin.support.documentLabel', { id: g.object_id }))
  const items = grants.data ?? []
  const target = items.find((g) => g.id === revoking)

  return (
    <section>
      <AdminHead title={t('admin.support.title')} subtitle={t('admin.support.subtitle')} />
      <p className={styles.notice} role="note">
        {t('admin.support.how')}
      </p>
      <MutationNotice error={revoke.error} title={t('admin.support.revokeFailed')} />

      <StateBoundary
        state={viewStateOf(grants, { isEmpty: (d) => (d as unknown[]).length === 0 })}
        errorValue={grants.error}
        onRetry={() => void grants.refetch()}
        empty={
          <div className={styles.empty}>
            <h2>{t('admin.support.empty.title')}</h2>
            <p>{t('admin.support.empty.body')}</p>
          </div>
        }
      >
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t('admin.support.scope')}</th>
              <th scope="col">{t('admin.support.who')}</th>
              <th scope="col">{t('admin.support.reason')}</th>
              <th scope="col">{t('admin.support.state')}</th>
              <th scope="col">{t('admin.support.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((g) => {
              const state = grantState(g, now)
              return (
                <tr key={g.id}>
                  <th scope="row">
                    <span className={styles.code}>{objectLabel(g)}</span>
                    <div className={styles.hint}>{t(`admin.support.scopes.${g.scope}`, { defaultValue: g.scope })}</div>
                  </th>
                  <td>
                    {t('admin.support.grantedBy', { researcher: g.researcher?.display_name ?? (g.researcher_id ? accountCode(g.researcher_id) : '—'), admin: g.admin?.display_name ?? '—' })}
                    <div className={styles.hint}>{g.created_at ? date(g.created_at, { time: true }) : ''}</div>
                  </td>
                  <td>{g.reason ? <BidiText>{g.reason}</BidiText> : '—'}</td>
                  <td>
                    <span className={[styles.badge, state.state === 'expired' ? styles.badgeDashed : ''].join(' ')}>
                      {state.state === 'active' ? t('admin.support.active', { hours: state.hoursLeft }) : t('admin.support.expired')}
                    </span>
                    {g.expires_at ? <div className={styles.hint}>{t('admin.support.until', { when: date(g.expires_at, { time: true }) })}</div> : null}
                  </td>
                  <td>
                    {state.state === 'active' && g.admin_id === me?.id ? (
                      <Button variant="ghost" onClick={() => setRevoking(g.id)} aria-label={`${t('admin.support.revoke')} ${objectLabel(g)}`}>
                        {t('admin.support.revoke')}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </StateBoundary>

      <p className={styles.hint}>{t('admin.support.private')}</p>

      <ConfirmAction
        open={revoking !== null && !!target}
        danger
        title={t('admin.support.revokeTitle', { object: target ? objectLabel(target) : '' })}
        confirmLabel={t('admin.support.revokeConfirm')}
        busy={revoke.isPending}
        onCancel={() => setRevoking(null)}
        onConfirm={() => revoking !== null && revoke.mutate(revoking)}
      >
        <p>{t('admin.support.revokeBody')}</p>
      </ConfirmAction>
    </section>
  )
}
