import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { ApiError } from '@/api/errors'
import { acquireLock, releaseLock } from '@/api/documents'
import { qk } from '@/api/queryKeys'

/** The server drops a lock after 15 minutes; taking it again as the same person extends it. */
const REFRESH_MS = 10 * 60_000

export interface LockInfo {
  /** `held`: this person may edit. `other`: someone else is editing. `failed`: it could not be taken (try again). */
  state: 'checking' | 'held' | 'other' | 'failed' | 'off'
  lockedBy: string | null
  until: string | null
  recheck: () => void
}

/**
 * The advisory edit lock of a document (the server does not enforce it on save, request file C-18, but it tells the
 * second person that someone is editing). Taking it is idempotent for the same person, so it is a query that
 * refreshes itself; it is released when the editor closes.
 */
export function useEditLock(projectId: number, documentId: number, enabled: boolean): LockInfo {
  const lock = useQuery({
    queryKey: qk.project(projectId).documents.lock(documentId),
    queryFn: () => acquireLock(projectId, documentId),
    enabled,
    retry: false,
    gcTime: 0,
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: false,
  })

  const held = lock.isSuccess
  // Give the lock back when the editor closes, so the next person is not made to wait for the timeout.
  useEffect(() => {
    if (!held) return
    return () => {
      void releaseLock(projectId, documentId).catch(() => undefined)
    }
  }, [held, projectId, documentId])

  if (!enabled) return { state: 'off', lockedBy: null, until: null, recheck: () => undefined }
  if (lock.isPending) return { state: 'checking', lockedBy: null, until: null, recheck: () => void lock.refetch() }
  if (held) return { state: 'held', lockedBy: null, until: lock.data.expires_at ?? null, recheck: () => void lock.refetch() }

  const err = lock.error
  if (err instanceof ApiError && err.status === 423) {
    const details = (err.details ?? {}) as { locked_by_name?: string; expires_at?: string }
    return { state: 'other', lockedBy: details.locked_by_name ?? null, until: details.expires_at ?? null, recheck: () => void lock.refetch() }
  }
  return { state: 'failed', lockedBy: null, until: null, recheck: () => void lock.refetch() }
}
