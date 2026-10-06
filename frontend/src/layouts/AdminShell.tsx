import { Link, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/app/authContext'
import { usePreferences } from '@/app/preferencesContext'
import { useAdminCounts } from '@/features/admin/useAdminCounts'
import { LanguageSwitcher } from './LanguageSwitcher'
import { NavItem } from './NavItem'
import { ViewportNotice } from './AccountShell'
import styles from './Shell.module.css'

/**
 * The administration area (screen 13): its own rail, separate from the researcher's, with the numbers an administrator
 * checks first beside each view, and a way back to the researcher view. Only reachable by administrators (RequireAdmin).
 */
export function AdminShell() {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const { user } = useAuth()
  const counts = useAdminCounts()
  const count = (value: number | undefined) => (value === undefined ? null : n(value))

  return (
    <>
      <div className={styles.app}>
        <a className={styles.skip} href="#main">
          {t('nav.skip')}
        </a>
        <aside className={styles.rail}>
          <div>
            <div className={styles.brand}>{t('app.name')}</div>
            <div className={styles.tagline}>{t('admin.tagline')}</div>
          </div>
          <nav className={styles.nav} aria-label={t('admin.nav.label')}>
            <NavItem to="/admin/applications" label={t('admin.nav.applications')} count={count(counts.applications)} />
            <NavItem to="/admin/accounts" label={t('admin.nav.accounts')} count={count(counts.accounts)} />
            <NavItem to="/admin/proposals" label={t('admin.nav.proposals')} count={count(counts.proposals)} />
            <NavItem to="/admin/limits" label={t('admin.nav.limits')} />
            <NavItem to="/admin/support" label={t('admin.nav.support')} count={count(counts.support)} />
            <NavItem to="/admin/audit" label={t('admin.nav.audit')} />
            <NavItem
              to="/admin/operations"
              label={t('admin.nav.operations')}
              count={counts.alerts ? t('admin.nav.alerts', { count: counts.alerts, formattedCount: n(counts.alerts) }) : null}
            />
          </nav>
          <div className={styles.railFooter}>
            {user ? <div>{t('shell.signedInAs', { name: user.display_name })}</div> : null}
            <LanguageSwitcher />
            <Link to="/home">{t('admin.exit')}</Link>
          </div>
        </aside>
        <main id="main" className={styles.main}>
          <Outlet />
        </main>
      </div>
      <ViewportNotice />
    </>
  )
}
