import { z } from 'zod'
import { ApiError, normalizeError } from './errors'
import { api, apiUrl, session } from './http'
import {
  exportJobSchema,
  exportManifestSchema,
  exportPreviewSchema,
  exportQuotaSchema,
  type ExportJob,
} from './schemas/exports'

export type ExportScope = 'account' | 'project'

export interface ExportRequest {
  scope: ExportScope
  project_ids?: number[]
  include_personal_library?: boolean
}

export async function listExports(page = 1, signal?: AbortSignal) {
  const res = await api('/exports', {
    query: { page, per_page: 20 },
    schema: z.array(exportJobSchema),
    signal,
  })
  return { items: res.data, pagination: res.pagination }
}

export async function getQuota(signal?: AbortSignal) {
  const { data } = await api('/exports/quota', { schema: exportQuotaSchema, signal })
  return data
}

export async function previewExport(request: ExportRequest, signal?: AbortSignal) {
  const { data } = await api('/exports/preview', { method: 'POST', body: request, schema: exportPreviewSchema, signal })
  return data
}

/**
 * The first answer is `{ job_id, export_job }` (201) but a repeat with the same Idempotency-Key answers with the
 * bare job (200), so both shapes are accepted (request file C-17). The key is chosen by the caller and kept for
 * one attempt, so a double click cannot start two exports.
 */
export async function createExport(request: ExportRequest, idempotencyKey: string): Promise<ExportJob> {
  const { data } = await api('/exports', {
    method: 'POST',
    // Only ZIP with Unicode JSON is produced today, whatever formats are asked for (C-17).
    body: { ...request, formats: ['zip'] },
    headers: { 'Idempotency-Key': idempotencyKey },
    schema: z.union([z.object({ export_job: exportJobSchema }).transform((d) => d.export_job), exportJobSchema]),
  })
  return data
}

export async function cancelExport(id: number) {
  const { data } = await api(`/exports/${id}/cancel`, { method: 'POST', schema: exportJobSchema })
  return data
}

export async function getExport(id: number, signal?: AbortSignal) {
  const { data } = await api(`/exports/${id}`, { schema: exportJobSchema, signal })
  return data
}

export async function getManifest(id: number, signal?: AbortSignal) {
  const { data } = await api(`/exports/${id}/manifest`, { schema: exportManifestSchema, signal })
  return data
}

/**
 * Saves a package to the researcher's computer. The file needs the sign-in token, so an ordinary link will not
 * do: it is fetched with the token and saved from memory. Access is checked again by the server at this point.
 */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  let res: Response
  try {
    const token = session.get()
    res = await fetch(apiUrl(path), { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  } catch (cause) {
    throw new ApiError({ status: 0, code: 'NETWORK', message: 'The server did not respond.', details: cause })
  }
  if (!res.ok) {
    let json: unknown
    try {
      json = await res.json()
    } catch {
      json = undefined
    }
    throw normalizeError(res.status, json, res.headers.get('Retry-After'))
  }
  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const name = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1] ?? fallbackName
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = decodeURIComponent(name)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export const partPath = (jobId: number, partId: number) => `/exports/${jobId}/parts/${partId}/download`
/** Older project-level exports have no parts; they are downloaded through the project. */
export const projectDownloadPath = (projectId: number, jobId: number) => `/projects/${projectId}/exports/${jobId}/download`
