import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/app/authContext'
import { Button } from '@/components/Button'
import { LanguageSwitcher } from './LanguageSwitcher'
import { NavItem } from './NavItem'
import styles from './Shell.module.css'

/** Left account rail from the navigation map: Home · My Library · Projects · Saved Searches · Notifications · Downloads · Profile/Settings. */
export function AccountShell() {
  const { t } = useTranslation()
  const { user, signOut, isAdmin } = useAuth()

  return (
    <>
      <div className={styles.app}>
        <a className={styles.skip} href="#main">
          {t('nav.skip')}
        </a>
        <aside className={styles.rail}>
          <div>
            <div className={styles.brand}>{t('app.name')}</div>
            <div className={styles.tagline}>{t('app.tagline')}</div>
          </div>
          <nav className={styles.nav} aria-label={t('nav.account')}>
            <NavItem to="/home" label={t('nav.home')} />
            <NavItem to="/library" label={t('nav.library')} />
            <NavItem to="/projects" label={t('nav.projects')} />
            <NavItem to="/searches" label={t('nav.savedSearches')} />
            <NavItem to="/notifications" label={t('nav.notifications')} release="R1b" />
            <NavItem to="/downloads" label={t('nav.downloads')} />
            <NavItem to="/settings" label={t('nav.settings')} />
            {isAdmin ? <NavItem to="/admin/applications" label={t('nav.administration')} /> : null}
          </nav>
          <div className={styles.railFooter}>
            {user ? <div>{t('shell.signedInAs', { name: user.display_name })}</div> : null}
            <LanguageSwitcher />
            {user ? (
              <Button variant="ghost" onClick={() => void signOut()}>
                {t('common.signOut')}
              </Button>
            ) : null}
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

export function ViewportNotice() {
  const { t } = useTranslation()
  return (
    <div className={styles.tooSmall} role="status">
      <h1>{t('viewport.title')}</h1>
      <p>{t('viewport.body')}</p>
    </div>
  )
}
