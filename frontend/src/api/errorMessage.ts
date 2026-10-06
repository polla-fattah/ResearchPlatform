import type { TFunction } from 'i18next'
import { ApiError, userMessage } from './errors'

/**
 * The words shown to a researcher for any failed request (state rule S6: one place decides them).
 *  - a write the server accepted but did not keep (`NOT_PERSISTED`, found by reading the result back) says exactly that;
 *  - a client error (4xx) carries a message written for people, so it is shown;
 *  - anything else (5xx, network) gets the plain fallback, never raw server text.
 */
export function errorMessage(err: unknown, t: TFunction): string {
  if (err instanceof ApiError && err.code === 'NOT_PERSISTED') {
    const what = (err.details as { what?: string } | undefined)?.what ?? 'change'
    return t('common.notPersisted', { what: t(`common.what.${what}`, { defaultValue: what }) })
  }
  if (err instanceof ApiError && err.code === 'NETWORK') return t('states.error.network')
  return userMessage(err, t('states.error.body'))
}
