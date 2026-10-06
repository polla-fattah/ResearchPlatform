import { z } from 'zod'
import { api } from './http'
import { publicAnnouncementSchema } from './schemas/publicAnnouncement'

export const PUBLIC_ANNOUNCEMENTS_PER_PAGE = 12

export interface PublicAnnouncementQuery {
  q?: string
  research_stage?: string
  page?: number
}

/** The published announcements. No sign-in is needed, and none is used for what is asked. */
export async function listPublicAnnouncements(query: PublicAnnouncementQuery = {}, signal?: AbortSignal) {
  const res = await api('/public/announcements', { query: { ...query, per_page: PUBLIC_ANNOUNCEMENTS_PER_PAGE }, schema: z.array(publicAnnouncementSchema), signal })
  return { items: res.data, pagination: res.pagination }
}

/** One published announcement by its address; anything that is not published answers 404. */
export async function getPublicAnnouncement(slug: string, signal?: AbortSignal) {
  const { data } = await api(`/public/announcements/${encodeURIComponent(slug)}`, { schema: publicAnnouncementSchema, signal })
  return data
}
