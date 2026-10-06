import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { listClosures, listUsers } from '@/api/admin'
import { qk } from '@/api/queryKeys'
import type { AdminUser, ClosureRequest } from '@/api/schemas/admin'
import { useAuth } from '@/app/authContext'
import { usePreferences } from '@/app/preferencesContext'
import { NeutralState } from '@/components/Badges'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { Pagination } from '@/components/Pagination'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { useDraftParam, useQueryParams } from '@/hooks/useQueryParams'
import { AdminHead } from './AdminHead'
import { ClosureDialog, RoleDialog, StatusDialog } from './AccountDialogs'
import { ACCOUNT_STATUSES, accountCode, topRole } from './adminModel'
import styles from './Admin.module.css'

type Dialog = { kind: 'role' | 'suspend' | 'reactivate'; id: number } | { kind: 'closure'; id: number } | null

/** Screen 13, Accounts and roles: who has an account, what role and state it is in, and the changes an administrator can make. */
export function AccountsPage() {
  const { t } = useTranslation()
  const { n, date } = usePreferences()
  const { user: me } = useAuth()
  const url = useQueryParams()
  const search = useDraftParam('q', { delay: 300 })
  const [dialog, setDialog] = useState<Dialog>(null)

  const q = url.text('q')
  const status = url.oneOf('status', ['', ...ACCOUNT_STATUSES] as const, '')

  const list = useQuery({
    queryKey: qk.admin.users({ q, status, page: url.page }),
    queryFn: ({ signal }) => listUsers({ q: q || undefined, status: status || undefined, page: url.page }, signal),
    placeholderData: keepPreviousData,
  })
  const closures = useQuery({ queryKey: qk.admin.closures, queryFn: ({ signal }) => listClosures(signal) })

  const items = list.data?.items ?? []
  const total = list.data?.pagination?.total_items ?? items.length
  const target = dialog && dialog.kind !== 'closure' ? items.find((u) => u.id === dialog.id) : undefined
  const closing = dialog?.kind === 'closure' ? closures.data?.items.find((c) => c.id === dialog.id) : undefined

  return (
    <section>
      <AdminHead title={t('admin.accounts.title')} subtitle={t('admin.accounts.subtitle', { count: total, formattedCount: n(total) })} />

      <p className={styles.hint}>{t('admin.accounts.noStepUp')}</p>

      <ClosureSection items={closures.data?.items ?? []} failed={closures.isError} onReview={(c) => setDialog({ kind: 'closure', id: c.id })} />

      <form
        className={styles.filters}
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          search.commit(search.text.trim())
        }}
      >
        <label>
          {t('admin.accounts.search')}
          <input dir="auto" value={search.text} onChange={(e) => search.setText(e.target.value)} />
        </label>
        <label>
          {t('admin.accounts.statusFilter')}
          <select value={status} onChange={(e) => url.set({ status: e.target.value })}>
            <option value="">{t('admin.accounts.anyStatus')}</option>
            {ACCOUNT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`admin.accounts.status.${s}`)}
              </option>
            ))}
          </select>
        </label>
      </form>

      <StateBoundary
        state={viewStateOf(list, { isEmpty: (d) => (d as { items: unknown[] }).items.length === 0 })}
        errorValue={list.error}
        onRetry={() => void list.refetch()}
        empty={
          <div className={styles.empty}>
            <h2>{t('admin.accounts.empty.title')}</h2>
            <p>{t('admin.accounts.empty.body')}</p>
          </div>
        }
      >
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t('admin.accounts.account')}</th>
              <th scope="col">{t('admin.accounts.role.column')}</th>
              <th scope="col">{t('admin.accounts.statusColumn')}</th>
              <th scope="col">{t('admin.accounts.mfa')}</th>
              <th scope="col">{t('admin.accounts.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <AccountRow key={u.id} user={u} isMe={u.id === me?.id} onAct={(kind) => setDialog({ kind, id: u.id })} date={date} />
            ))}
          </tbody>
        </table>
        {list.data?.pagination ? <Pagination pagination={list.data.pagination} onPage={(page) => url.set({ page }, { keepPage: true })} /> : null}
      </StateBoundary>

      {dialog?.kind === 'role' && target ? <RoleDialog user={target} onClose={() => setDialog(null)} /> : null}
      {(dialog?.kind === 'suspend' || dialog?.kind === 'reactivate') && target ? <StatusDialog user={target} action={dialog.kind} onClose={() => setDialog(null)} /> : null}
      {closing ? <ClosureDialog request={closing} onClose={() => setDialog(null)} /> : null}
    </section>
  )
}

function AccountRow({ user: u, isMe, onAct, date }: { user: AdminUser; isMe: boolean; onAct: (kind: 'role' | 'suspend' | 'reactivate') => void; date: (v: string) => string }) {
  const { t } = useTranslation()
  const role = topRole(u.roles)
  const suspended = u.status === 'suspended'
  return (
    <tr>
      <th scope="row">
        <BidiText>{u.display_name}</BidiText>
        {isMe ? ` (${t('admin.accounts.you')})` : ''}
        <div className={styles.hint}>
          <span className={styles.code}>{accountCode(u.id)}</span> · {u.email}
          {u.created_at ? ` · ${t('admin.accounts.joined', { when: date(u.created_at) })}` : ''}
        </div>
      </th>
      <td>{role ? t(`admin.roles.${role}`) : <NeutralState kind="unknown">{t('admin.accounts.noRole')}</NeutralState>}</td>
      <td>
        <span className={[styles.badge, suspended || u.status !== 'approved' ? styles.badgeDashed : ''].join(' ')}>{t(`admin.accounts.status.${u.status}`, { defaultValue: u.status })}</span>
      </td>
      <td>{u.mfa === 'totp' ? t('admin.accounts.mfaOn') : t('admin.accounts.mfaOff')}</td>
      <td>
        <div className={styles.actions}>
          <Button disabled={isMe} title={isMe ? t('admin.accounts.ownRole') : undefined} onClick={() => onAct('role')} aria-label={`${t('admin.accounts.role.action')} ${u.display_name}`}>
            {t('admin.accounts.role.action')}
          </Button>
          {u.status === 'approved' && !isMe ? (
            <Button variant="ghost" onClick={() => onAct('suspend')} aria-label={`${t('admin.accounts.suspend.action')} ${u.display_name}`}>
              {t('admin.accounts.suspend.action')}
            </Button>
          ) : null}
          {suspended ? (
            <Button variant="ghost" onClick={() => onAct('reactivate')} aria-label={`${t('admin.accounts.reactivate.action')} ${u.display_name}`}>
              {t('admin.accounts.reactivate.action')}
            </Button>
          ) : null}
          {u.status === 'pending' ? <Link to="/admin/applications">{t('admin.accounts.openApplication')}</Link> : null}
        </div>
      </td>
    </tr>
  )
}

function ClosureSection({ items, failed, onReview }: { items: ClosureRequest[]; failed: boolean; onReview: (c: ClosureRequest) => void }) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  return (
    <section className={styles.section} aria-label={t('admin.accounts.closure.heading')}>
      <h2>{t('admin.accounts.closure.heading', { count: items.length, formattedCount: n(items.length) })}</h2>
      {failed ? <p role="alert">{t('admin.accounts.closure.loadFailed')}</p> : null}
      {!failed && items.length === 0 ? <p className={styles.hint}>{t('admin.accounts.closure.none')}</p> : null}
      <ul className={styles.thread}>
        {items.map((c) => (
          <li key={c.id}>
            <BidiText>{c.display_name}</BidiText> · {c.email}{' '}
            <Button onClick={() => onReview(c)} aria-label={`${t('admin.accounts.closure.review')} ${c.display_name}`}>
              {t('admin.accounts.closure.review')}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
