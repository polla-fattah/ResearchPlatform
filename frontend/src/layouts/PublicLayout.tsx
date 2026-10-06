import { Link, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/app/authContext'
import { LanguageSwitcher } from './LanguageSwitcher'
import styles from './Shell.module.css'

/** Public site shell (sign-in, apply, announcements, published research). Readable on tablets. */
export function PublicLayout() {
  const { t } = useTranslation()
  const { status } = useAuth()
  return (
    <>
      <header className={styles.publicHeader}>
        <Link to="/" className={styles.brand}>
          {t('app.name')}
        </Link>
        <nav className={styles.publicNav}>
          <LanguageSwitcher />
          {status === 'authenticated' ? (
            <Link to="/home">{t('nav.home')}</Link>
          ) : (
            <>
              <Link to="/sign-in">{t('common.signIn')}</Link>
              <Link to="/apply">{t('common.apply')}</Link>
            </>
          )}
        </nav>
      </header>
      <main className={styles.publicMain}>
        <Outlet />
      </main>
    </>
  )
}
