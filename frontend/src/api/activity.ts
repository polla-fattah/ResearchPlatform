import { z } from 'zod'
import { api } from './http'
import { activitySchema } from './schemas/activity'

export const ACTIVITY_PER_PAGE = 30

export interface ActivityQuery {
  actor_id?: number
  object_type?: string
  action?: string
  /** A day (YYYY-MM-DD): entries from the start of that day. */
  from?: string
  page?: number
}

export async function listActivity(projectId: number, query: ActivityQuery = {}, signal?: AbortSignal) {
  const res = await api(`/projects/${projectId}/activity`, { query: { ...query, per_page: ACTIVITY_PER_PAGE }, schema: z.array(activitySchema), signal })
  return { items: res.data, pagination: res.pagination }
}
