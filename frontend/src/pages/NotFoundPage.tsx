import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

/** Same wording as "forbidden": a missing page and a private one look identical. */
export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <main>
      <h1>{t('states.forbidden.title')}</h1>
      <p>{t('states.forbidden.body')}</p>
      <Link to="/">{t('nav.home')}</Link>
    </main>
  )
}
