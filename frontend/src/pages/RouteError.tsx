import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useRouteError } from 'react-router-dom'
import { reportError } from '@/app/errorReporting'
import { Button } from '@/components/Button'

/** A page's code could not be fetched (the connection dropped, or a new release replaced the file the old page asks for). */
const isLoadFailure = (error: unknown): boolean =>
  error instanceof Error && (/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(error.message) || error.name === 'ChunkLoadError')

/**
 * What a person sees when a page breaks while it is drawn. It never shows the error's text or stack (they can name files
 * and internals); that goes to `reportError`. The shell around the page stays, and Reload tries the page again.
 */
export function RouteError() {
  const { t } = useTranslation()
  const error = useRouteError()
  useEffect(() => {
    reportError(error, 'route')
  }, [error])
  const load = isLoadFailure(error)
  return (
    <section role="alert">
      <h1>{load ? t('routeError.load.title') : t('routeError.title')}</h1>
      <p>{load ? t('routeError.load.body') : t('routeError.body')}</p>
      <p>
        <Button variant="primary" onClick={() => window.location.reload()}>
          {t('routeError.reload')}
        </Button>{' '}
        <Link to="/home">{t('routeError.home')}</Link>
      </p>
    </section>
  )
}
