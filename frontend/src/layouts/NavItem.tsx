import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { isReleaseEnabled, type Release } from '@/app/features'
import styles from './Shell.module.css'

interface Props {
  to: string
  label: string
  release?: Release
  tabStyle?: boolean
  end?: boolean
  /** A number (or short word) shown at the end of the item: waiting applications, alerts. */
  count?: string | number | null
}

/**
 * Link that is shown disabled, with its release tag, until that release is enabled
 * (as in the mockups: "Notifications [R1b]").
 */
export function NavItem({ to, label, release = 'R1a', tabStyle, end, count }: Props) {
  const { t } = useTranslation()
  const base = tabStyle ? styles.tab : styles.navItem
  const activeClass = tabStyle ? styles.tabActive : styles.active

  if (!isReleaseEnabled(release)) {
    return (
      <span
        className={[base, styles.disabled].join(' ')}
        aria-disabled="true"
        title={t('release.notYet', { release })}
      >
        {label}
        <span className={styles.tag}>{release}</span>
      </span>
    )
  }

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => [base, isActive ? activeClass : ''].join(' ')}
    >
      {label}
      {count !== undefined && count !== null && count !== '' ? <span className={styles.count}>{count}</span> : null}
    </NavLink>
  )
}
