import { Link, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/app/authContext'
import { Button } from '@/components/Button'
import { LanguageSwitcher } from '@/layouts/LanguageSwitcher'
import styles from './Registration.module.css'

/** Header for the public onboarding screens: brand, Sign in, Apply (or Sign out once signed in). */
export function RegistrationLayout() {
  const { t } = useTranslation()
  const { status, signOut } = useAuth()
  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.brand}>
            {t('app.name')}
            <span className={styles.brandTag}>{t('registration.brandTag')}</span>
          </Link>
          <nav className={styles.nav}>
            <LanguageSwitcher />
            {status === 'authenticated' ? (
              <Button variant="ghost" onClick={() => void signOut()}>
                {t('common.signOut')}
              </Button>
            ) : (
              <>
                <Link to="/sign-in" className={styles.navLink}>
                  {t('common.signIn')}
                </Link>
                <Link to="/apply" className={[styles.navLink, styles.navPrimary].join(' ')}>
                  {t('common.apply')}
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <Outlet />
    </>
  )
}
