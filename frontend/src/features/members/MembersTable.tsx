import { useTranslation } from 'react-i18next'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { ROLE_LABEL_KEYS } from '@/domain/roles'
import type { MemberRow } from './membersModel'
import styles from './Members.module.css'

interface Props {
  rows: readonly MemberRow[]
  meId: number | null
  canManage: boolean
  onChangeRole: (row: MemberRow) => void
  onRemove: (row: MemberRow) => void
  onLeave: () => void
}

/** Who is in the project, their role, when they joined and what they have added. Actions follow the viewer's role. */
export function MembersTable({ rows, meId, canManage, onChangeRole, onRemove, onLeave }: Props) {
  const { t } = useTranslation()
  const { n, date } = usePreferences()

  return (
    <table className={styles.table} aria-label={t('members.table.label')}>
      <thead>
        <tr>
          <th scope="col">{t('members.table.person')}</th>
          <th scope="col">{t('members.table.role')}</th>
          <th scope="col">{t('members.table.joined')}</th>
          <th scope="col">{t('members.table.added')}</th>
          <th scope="col">
            <span className="sr-only">{t('members.table.actions')}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const me = r.userId === meId
          const c = r.contributions
          return (
            <tr key={r.userId}>
              <th scope="row">
                <span className={styles.name}>
                  <BidiText>{r.name || t('members.unnamed')}</BidiText>
                </span>
                {me ? <span className={styles.you}>{t('members.you')}</span> : null}
                {r.affiliation ? (
                  <div className={styles.muted}>
                    <BidiText>{r.affiliation}</BidiText>
                  </div>
                ) : null}
              </th>
              <td>
                <span className={styles.role}>{t(ROLE_LABEL_KEYS[r.role])}</span>
              </td>
              <td>{r.joinedAt ? date(r.joinedAt) : <span className={styles.muted}>{t('members.joinedUnknown')}</span>}</td>
              <td>
                {c ? (
                  <span>
                    {t('members.added.summary', {
                      evidence: n(c.evidence),
                      documents: n(c.documents),
                      comments: n(c.comments),
                      tasks: n(c.tasks),
                    })}
                  </span>
                ) : (
                  <span className={styles.muted}>{t('members.added.unknown')}</span>
                )}
              </td>
              <td>
                <div className={styles.actions}>
                  {canManage && !r.isOwner ? (
                    <>
                      <Button onClick={() => onChangeRole(r)} aria-label={t('members.changeRoleOf', { name: r.name })}>
                        {t('members.changeRole')}
                      </Button>
                      <Button variant="danger" onClick={() => onRemove(r)} aria-label={t('members.removeOf', { name: r.name })}>
                        {t('members.remove')}
                      </Button>
                    </>
                  ) : null}
                  {me && !r.isOwner ? <Button onClick={onLeave}>{t('members.leave')}</Button> : null}
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
