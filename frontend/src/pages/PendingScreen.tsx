import { useTranslation } from 'react-i18next'
import type { ScreenDef } from '@/app/screens'
import { NeutralState } from '@/components/Badges'

/** Placeholder for a screen that is in the plan but not built yet. */
export function PendingScreen({ screen }: { screen: ScreenDef }) {
  const { t } = useTranslation()
  return (
    <section>
      <p className="mono">
        {screen.id} · {t('pending.release', { release: screen.release })}
      </p>
      <h1>{screen.name}</h1>
      <p>{t('pending.body')}</p>
      <ul>
        <li>{t('pending.mockup', { file: `${screen.mockup}.dc.html` })}</li>
        <li>{t('pending.requirements', { reqs: screen.reqs })}</li>
      </ul>
      {screen.apis?.length ? (
        <p>
          <NeutralState kind="limitation">
            {t('pending.apis', { apis: screen.apis.join(', ') })}
          </NeutralState>
        </p>
      ) : null}
    </section>
  )
}
