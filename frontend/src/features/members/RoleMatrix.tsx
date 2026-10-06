import { useTranslation } from 'react-i18next'
import { ROLE_LABEL_KEYS } from '@/domain/roles'
import { ROLES, roleMatrix } from './membersModel'
import styles from './Members.module.css'

/** What each role can do. Read from the permission table the screens themselves use, so it cannot drift from them. */
export function RoleMatrix() {
  const { t } = useTranslation()
  return (
    <table className={[styles.table, styles.matrix].join(' ')} aria-label={t('members.matrix.title')}>
      <thead>
        <tr>
          <th scope="col">{t('members.matrix.action')}</th>
          {ROLES.map((r) => (
            <th key={r} scope="col">
              {t(ROLE_LABEL_KEYS[r])}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {roleMatrix().map((row) => (
          <tr key={row.action}>
            <th scope="row">{t(`members.matrix.actions.${row.action}`)}</th>
            {row.allowed.map((ok, i) => (
              <td key={ROLES[i]} className={ok ? styles.yes : styles.no}>
                <span aria-hidden="true">{ok ? '✓' : '–'}</span>
                <span className="sr-only">{ok ? t('members.matrix.can') : t('members.matrix.cannot')}</span>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
