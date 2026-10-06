import { ApiError } from './errors'
import { api } from './http'
import { announcementHistorySchema, announcementOrNullSchema, announcementSchema, type AnnouncementStatus } from './schemas/announcement'

const notKept = (what: string) =>
  new ApiError({ status: 200, code: 'NOT_PERSISTED', message: `The server did not keep the ${what}.`, details: { what } })

export async function getAnnouncement(projectId: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/announcement`, { schema: announcementOrNullSchema, signal })
  return data
}

export interface AnnouncementFields {
  public_slug: string
  title: string
  summary: string
  research_stage: string
  keywords: string[]
}

/**
 * Saves the announcement. The server turns a missing `status` into `draft`, which would quietly take a published page
 * down, so the status to keep is always sent (request file C-26). Every field is read back.
 */
export async function saveAnnouncement(projectId: number, fields: AnnouncementFields, status: Extract<AnnouncementStatus, 'draft' | 'published' | 'unpublished'>) {
  const { data } = await api(`/projects/${projectId}/announcement`, { method: 'POST', body: { ...fields, status }, schema: announcementSchema })
  if (data.title !== fields.title) throw notKept('title')
  if (data.summary !== fields.summary) throw notKept('summary')
  if (data.public_slug !== fields.public_slug) throw notKept('address')
  if (data.research_stage !== fields.research_stage) throw notKept('stage')
  if ((data.keywords ?? []).join('\u0000') !== fields.keywords.join('\u0000')) throw notKept('keywords')
  return data
}

export async function publishAnnouncement(projectId: number) {
  const { data } = await api(`/projects/${projectId}/announcement/publish`, { method: 'POST', schema: announcementSchema })
  if (data.status !== 'published') throw notKept('change')
  return data
}

export async function unpublishAnnouncement(projectId: number) {
  const { data } = await api(`/projects/${projectId}/announcement/unpublish`, { method: 'POST', schema: announcementSchema })
  if (data.status !== 'unpublished') throw notKept('change')
  return data
}

/** What the server remembers of an announcement: today only that it was taken down (request file C-26). */
export async function getAnnouncementHistory(projectId: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/announcement/history`, { schema: announcementHistorySchema, signal })
  return data.history
}
