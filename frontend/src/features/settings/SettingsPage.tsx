import { useTranslation } from 'react-i18next'
import { useAuth } from '@/app/authContext'
import { NeutralState } from '@/components/Badges'
import { useQueryParams } from '@/hooks/useQueryParams'
import { AccountTab } from './AccountTab'
import { DisplayTab } from './DisplayTab'
import { MfaSection } from './MfaSection'
import { NotificationsTab } from './NotificationsTab'
import { PasswordForm } from './PasswordForm'
import { ProfileTab } from './ProfileTab'
import { SessionsSection } from './SessionsSection'
import { SETTINGS_TABS } from './settingsModel'
import styles from './Settings.module.css'

/**
 * Screen 14. The tab is in the address. The three tabs with a form to save (profile, display, notifications) stay
 * mounted behind the others, so a half-finished edit is still there when the person comes back to the tab; the rest
 * open fresh each time.
 */
export function SettingsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const url = useQueryParams()
  const tab = url.oneOf('tab', SETTINGS_TABS, 'profile')

  if (!user) return null

  return (
    <section>
      <h1 className={styles.title}>{t('settings.title')}</h1>
      <div role="tablist" aria-label={t('settings.tabs.label')} className={styles.tabs}>
        {SETTINGS_TABS.map((k) => (
          <button key={k} type="button" role="tab" id={`tab-${k}`} aria-selected={tab === k} aria-controls={`panel-${k}`} className={styles.tab} onClick={() => url.set({ tab: k === 'profile' ? null : k })}>
            {t(`settings.tabs.${k}`)}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="panel-profile" aria-labelledby="tab-profile" hidden={tab !== 'profile'}>
        <ProfileTab me={user} />
      </div>
      <div role="tabpanel" id="panel-display" aria-labelledby="tab-display" hidden={tab !== 'display'}>
        <DisplayTab />
      </div>
      <div role="tabpanel" id="panel-notifications" aria-labelledby="tab-notifications" hidden={tab !== 'notifications'}>
        <NotificationsTab />
      </div>
      {tab === 'security' ? (
        <div role="tabpanel" id="panel-security" aria-labelledby="tab-security">
          <PasswordForm />
          <MfaSection me={user} />
          <SessionsSection />
        </div>
      ) : null}
      {tab === 'support' ? (
        <div role="tabpanel" id="panel-support" aria-labelledby="tab-support" className={styles.section}>
          <h2>{t('settings.support.title')}</h2>
          <p>{t('settings.support.body')}</p>
          <p>
            <NeutralState kind="limitation">{t('settings.support.unavailable')}</NeutralState>
          </p>
        </div>
      ) : null}
      {tab === 'account' ? (
        <div role="tabpanel" id="panel-account" aria-labelledby="tab-account">
          <AccountTab me={user} />
        </div>
      ) : null}
    </section>
  )
}
