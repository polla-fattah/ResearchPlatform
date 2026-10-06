import { ApiError } from '@/api/errors'

/** The six states every screen must handle (SRS §18, item 2). */
export type ViewState = 'normal' | 'empty' | 'loading' | 'error' | 'forbidden' | 'conflict'

interface QueryLike {
  isPending: boolean
  isError: boolean
  error: unknown
  data: unknown
}

/**
 * Maps a TanStack Query result onto a ViewState.
 * 403 and 404 both become `forbidden`, so a private object's existence is never revealed.
 */
export function viewStateOf(
  query: QueryLike,
  opts: { isEmpty?: (data: unknown) => boolean } = {},
): ViewState {
  if (query.isPending) return 'loading'
  if (query.isError) {
    const err = query.error
    if (err instanceof ApiError) {
      if (err.isNotAvailable) return 'forbidden'
      if (err.isConflict) return 'conflict'
    }
    return 'error'
  }
  if (opts.isEmpty?.(query.data)) return 'empty'
  return 'normal'
}
