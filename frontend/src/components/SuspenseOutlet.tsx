import { Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'

/**
 * Where a route's page appears. A page that is still being fetched shows a plain loading line here while the rest of the
 * layout (rail, tabs, header) stays on the screen.
 */
export function SuspenseOutlet() {
  const { t } = useTranslation()
  return (
    <Suspense fallback={<p role="status">{t('states.loading.label')}</p>}>
      <Outlet />
    </Suspense>
  )
}
