import { z } from 'zod'
import { ApiError } from './errors'
import { api } from './http'
import { myTaskSchema, notificationPageSchema, notificationSchema } from './schemas/notifications'

export const NOTIFICATIONS_PER_PAGE = 20

export interface NotificationQuery {
  type?: string
  page?: number
}

export async function listNotifications(query: NotificationQuery = {}, signal?: AbortSignal) {
  const res = await api('/notifications', { query: { ...query, per_page: NOTIFICATIONS_PER_PAGE }, schema: notificationPageSchema, signal })
  return { items: res.data.notifications, unread: res.data.unread_count, pagination: res.pagination }
}

export async function markRead(id: number) {
  const { data } = await api(`/notifications/${id}/read`, { method: 'PATCH', schema: notificationSchema })
  if (!data.is_read) {
    throw new ApiError({ status: 200, code: 'NOT_PERSISTED', message: 'The server did not keep the change.', details: { what: 'change' } })
  }
  return data
}

export async function markAllRead() {
  await api('/notifications/mark-all-read', { method: 'POST' })
}

/**
 * Which project a task belongs to. A task notification carries only the task's id, so it is looked up in the tasks
 * assigned to the person (the first hundred); a task that is not there has no link (request file C-24).
 */
export async function listAssignedTasks(signal?: AbortSignal) {
  const res = await api('/me/tasks', { query: { per_page: 100 }, schema: z.array(myTaskSchema), signal })
  return res.data
}
