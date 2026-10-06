import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { listAudit } from '@/api/admin'
import { qk } from '@/api/queryKeys'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Pagination } from '@/components/Pagination'
import { StateBoundary } from '@/components/StateBoundary'
import { StoredValue } from '@/components/StoredValue'
import { viewStateOf } from '@/components/viewState'
import { useNow } from '@/hooks/useNow'
import { useQueryParams } from '@/hooks/useQueryParams'
import { AdminHead } from './AdminHead'
import { AUDIT_ACTIONS, AUDIT_OBJECTS, AUDIT_WINDOWS, accountCode, objectCode, windowStart, type AuditWindow } from './adminModel'
import styles from './Admin.module.css'

const WINDOWS = ['', ...Object.keys(AUDIT_WINDOWS)] as const

/**
 * Screen 13, Audit log. Read-only: there is no way to edit or delete an entry from here. The filters the server offers
 * are the action, the kind of object, the actor and a time window; it has no free-text search, and it does not record
 * whether an attempt succeeded, so no outcome is shown (request file C-20).
 */
export function AuditPage() {
  const { t } = useTranslation()
  const { n, date } = usePreferences()
  const now = useNow()
  const url = useQueryParams()

  const action = url.text('action')
  const object = url.text('object')
  const actor = url.id('actor')
  const span = url.oneOf('window', WINDOWS, '')
  const from = span ? windowStart(span as AuditWindow, now) : undefined

  const log = useQuery({
    queryKey: qk.admin.audit({ action, object, actor, window: span, page: url.page }),
    queryFn: ({ signal }) => listAudit({ action: action || undefined, object_type: object || undefined, actor_id: actor, from, page: url.page }, signal),
    placeholderData: keepPreviousData,
  })
  const items = log.data?.items ?? []
  const total = log.data?.pagination?.total_items ?? items.length
  const filtered = !!(action || object || actor || span)

  return (
    <section>
      <AdminHead title={t('admin.audit.title')} subtitle={t('admin.audit.subtitle', { count: total, formattedCount: n(total) })} />

      <form className={styles.filters} role="search" aria-label={t('admin.audit.filters')} onSubmit={(e) => e.preventDefault()}>
        <label>
          {t('admin.audit.action')}
          <select value={action} onChange={(e) => url.set({ action: e.target.value })}>
            <option value="">{t('admin.audit.anyAction')}</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {t(`admin.audit.actions.${a}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('admin.audit.object')}
          <select value={object} onChange={(e) => url.set({ object: e.target.value })}>
            <option value="">{t('admin.audit.anyObject')}</option>
            {AUDIT_OBJECTS.map((o) => (
              <option key={o} value={o}>
                {t(`admin.audit.objects.${o}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('admin.audit.actor')}
          <input inputMode="numeric" value={actor ?? ''} placeholder={t('admin.audit.actorPlaceholder')} onChange={(e) => url.set({ actor: e.target.value.replace(/\D/g, '') })} />
        </label>
        <label>
          {t('admin.audit.window')}
          <select value={span} onChange={(e) => url.set({ window: e.target.value })}>
            <option value="">{t('admin.audit.anyTime')}</option>
            {(Object.keys(AUDIT_WINDOWS) as AuditWindow[]).map((w) => (
              <option key={w} value={w}>
                {t(`admin.audit.windows.${w}`)}
              </option>
            ))}
          </select>
        </label>
      </form>

      <StateBoundary
        state={viewStateOf(log, { isEmpty: (d) => (d as { items: unknown[] }).items.length === 0 })}
        errorValue={log.error}
        onRetry={() => void log.refetch()}
        empty={
          <div className={styles.empty}>
            <h2>{t(filtered ? 'admin.audit.noMatch.title' : 'admin.audit.empty.title')}</h2>
            <p>{t(filtered ? 'admin.audit.noMatch.body' : 'admin.audit.empty.body')}</p>
          </div>
        }
      >
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t('admin.audit.entry')}</th>
              <th scope="col">{t('admin.audit.time')}</th>
              <th scope="col">{t('admin.audit.actorColumn')}</th>
              <th scope="col">{t('admin.audit.actionColumn')}</th>
              <th scope="col">{t('admin.audit.objectColumn')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id}>
                <th scope="row" className={styles.code}>
                  {t('admin.audit.code', { id: String(e.id).padStart(5, '0') })}
                </th>
                <td>{e.created_at ? date(e.created_at, { time: true }) : '—'}</td>
                <td>
                  {e.actor ? <BidiText>{e.actor.display_name}</BidiText> : '—'}
                  {e.actor_id ? <div className={styles.code}>{accountCode(e.actor_id)}</div> : null}
                </td>
                <td>
                  {t(`admin.audit.actions.${e.action}`, { defaultValue: e.action })}
                  {e.details && Object.keys(e.details).length > 0 ? (
                    <details className={styles.details}>
                      <summary>{t('admin.audit.details')}</summary>
                      <StoredValue value={e.details} />
                    </details>
                  ) : null}
                </td>
                <td className={styles.code}>{objectCode(e.object_type, e.object_id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {log.data?.pagination ? <Pagination pagination={log.data.pagination} onPage={(page) => url.set({ page }, { keepPage: true })} /> : null}
      </StateBoundary>

      <p className={styles.hint}>{t('admin.audit.readOnly')}</p>
    </section>
  )
}
