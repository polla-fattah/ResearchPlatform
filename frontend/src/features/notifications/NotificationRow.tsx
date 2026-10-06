import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { AppNotification } from '@/api/schemas/notifications'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { isKnownType } from './notificationsModel'
import styles from './Notifications.module.css'

interface Props {
  item: AppNotification
  href: string | null
  busy: boolean
  onRead: () => void
}

/**
 * One notification. The words come from the server (it writes them, with the project's title in them); the kind, the
 * state (new or read, as text and not colour alone) and the way to open it are the screen's own.
 */
export function NotificationRow({ item, href, busy, onRead }: Props) {
  const { t } = useTranslation()
  const { relative } = usePreferences()
  const kind = isKnownType(item.type) ? t(`notifications.kinds.${item.type}`) : item.type
  return (
    <li className={[styles.row, item.is_read ? '' : styles.unread].join(' ')}>
      <div>
        <div>
          {!item.is_read ? <span className={styles.new}>{t('notifications.new')}</span> : null}
          <span className={styles.kind}>{kind}</span>
          {item.created_at ? <span className={styles.meta}>{relative(item.created_at)}</span> : null}
        </div>
        <p className={styles.text}>
          <BidiText>{item.message ?? item.title ?? ''}</BidiText>
        </p>
        {item.type === 'invitation' ? <p className={styles.meta}>{t('notifications.invitationHint')}</p> : null}
      </div>
      <div className={styles.actions}>
        {href ? (
          <Link to={href} onClick={item.is_read ? undefined : onRead}>
            {t('notifications.open')}
          </Link>
        ) : null}
        {!item.is_read ? (
          <Button onClick={onRead} disabled={busy}>
            {t('notifications.markRead')}
          </Button>
        ) : null}
      </div>
    </li>
  )
}
