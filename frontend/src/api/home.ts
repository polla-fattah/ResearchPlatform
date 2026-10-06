import { z } from 'zod'
import { api } from './http'
import { exportJobSchema } from './schemas/exports'

/**
 * Home is assembled from endpoints that work today. GET /home itself returns HTTP 500
 * (request file C-5) and its `updates` feed is invented (C-9), so it is not used.
 */
export const homeKeys = {
  exports: ['home', 'exports'] as const,
  openTasks: ['home', 'open-tasks'] as const,
  unread: ['home', 'unread'] as const,
}

export async function listMyExports(signal?: AbortSignal) {
  const { data } = await api('/me/exports', {
    query: { per_page: 3 },
    schema: z.array(exportJobSchema),
    signal,
  })
  return data
}

/** Number of open tasks assigned to me, across projects. */
export async function countMyOpenTasks(signal?: AbortSignal): Promise<number> {
  const res = await api('/me/tasks', {
    query: { status: 'open', per_page: 1 },
    schema: z.array(z.unknown()),
    signal,
  })
  return res.pagination?.total_items ?? res.data.length
}

export async function countUnreadNotifications(signal?: AbortSignal): Promise<number> {
  const { data } = await api('/notifications/unread-count', {
    schema: z.object({ unread_count: z.number() }),
    signal,
  })
  return data.unread_count
}
