import type { TFunction } from 'i18next'
import { ApiError, userMessage } from '@/api/errors'

/** Text for a failed write. A change the server accepted but did not keep gets its own wording. */
export function writeErrorMessage(err: unknown, t: TFunction): string {
  if (err instanceof ApiError && err.code === 'NOT_PERSISTED') {
    const what = (err.details as { what?: string } | undefined)?.what ?? 'note'
    return t('library.notPersisted', { what: t(`library.what.${what}`) })
  }
  return userMessage(err, t('states.error.body'))
}
