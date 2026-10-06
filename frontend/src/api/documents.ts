import { z } from 'zod'
import { ApiError } from './errors'
import { api } from './http'
import {
  citePreviewSchema,
  conflictSchema,
  documentSchema,
  draftSavedSchema,
  draftSchema,
  lockSchema,
  versionSchema,
  type CitationMode,
  type DocumentType,
  type SaveConflict,
} from './schemas/writing'

export async function listDocuments(projectId: number, q?: string, signal?: AbortSignal) {
  const res = await api(`/projects/${projectId}/documents`, {
    query: { per_page: 100, q },
    schema: z.array(documentSchema),
    signal,
  })
  return res.data
}

export async function getDocument(projectId: number, id: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/documents/${id}`, { schema: documentSchema, signal })
  return data
}

export interface NewDocument {
  title: string
  document_type: DocumentType
  language: string
  content: string
}

export async function createDocument(projectId: number, input: NewDocument) {
  const { data } = await api(`/projects/${projectId}/documents`, { method: 'POST', body: input, schema: documentSchema })
  return data
}

export async function updateDocument(projectId: number, id: number, patch: { title?: string; document_type?: DocumentType; language?: string }) {
  const { data } = await api(`/projects/${projectId}/documents/${id}`, { method: 'PATCH', body: patch, schema: documentSchema })
  if (patch.title !== undefined && data.title !== patch.title) throw notKept('title')
  return data
}

/**
 * Deletes a document with all its versions. The server refuses (409 HAS_DEPENDENCIES) while findings are linked to it or
 * it is cited, unless `confirm` is sent; the dialog that asks has already said what is linked, so it is sent.
 */
export async function deleteDocument(projectId: number, id: number) {
  await api(`/projects/${projectId}/documents/${id}`, { method: 'DELETE', query: { confirm: true } })
}

export async function getDraft(projectId: number, id: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/documents/${id}/draft`, { schema: draftSchema, signal })
  return data
}

/** Autosave: the text so far, stored per person, never as a version. */
export async function saveDraft(projectId: number, id: number, content: string, baseVersion: number | null) {
  const { data } = await api(`/projects/${projectId}/documents/${id}/draft`, {
    method: 'PUT',
    body: { content, base_version: baseVersion },
    schema: draftSavedSchema,
  })
  return data
}

export async function listVersions(projectId: number, id: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/documents/${id}/versions`, { schema: z.array(versionSchema), signal })
  return data
}

export async function getVersion(projectId: number, id: number, version: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/documents/${id}/versions/${version}`, { schema: versionSchema, signal })
  return data
}

export interface NewVersion {
  content: string
  change_summary?: string
  /** The version this text was written on top of. The server refuses the save if a newer one exists. */
  expected_version: number
  citations?: {
    resource_id: number
    evidence_id?: number
    locator?: string
    citation_type?: CitationMode
    formatted_citation: string
  }[]
}

/** Saves a version. A newer version on the server answers 409; `saveConflict` reads that answer. */
export async function createVersion(projectId: number, id: number, input: NewVersion) {
  const { data } = await api(`/projects/${projectId}/documents/${id}/versions`, {
    method: 'POST',
    body: input,
    schema: versionSchema,
  })
  if (data.content !== input.content) throw notKept('text')
  return data
}

/** The newer version behind a refused save, or null when the error is something else. */
export function saveConflict(err: unknown): SaveConflict | null {
  if (!(err instanceof ApiError) || err.status !== 409 || err.code !== 'CONFLICT') return null
  const parsed = conflictSchema.safeParse(err.details)
  return parsed.success ? parsed.data : null
}

export async function restoreVersion(projectId: number, id: number, version: number) {
  const { data } = await api(`/projects/${projectId}/documents/${id}/versions/${version}/restore`, {
    method: 'POST',
    schema: versionSchema,
  })
  return data
}

export async function previewCitation(projectId: number, id: number, evidenceId: number, mode: CitationMode) {
  const { data } = await api(`/projects/${projectId}/documents/${id}/cite`, {
    method: 'POST',
    body: { evidence_id: evidenceId, mode },
    schema: citePreviewSchema,
  })
  return data
}

export async function linkFindingToDocument(projectId: number, id: number, findingId: number) {
  const { data } = await api(`/projects/${projectId}/documents/${id}/findings/${findingId}`, { method: 'POST', schema: documentSchema })
  if (!data.findings?.some((f) => f.id === findingId)) throw notKept('link')
  return data
}

export async function unlinkFindingFromDocument(projectId: number, id: number, findingId: number) {
  await api(`/projects/${projectId}/documents/${id}/findings/${findingId}`, { method: 'DELETE' })
}

export async function acquireLock(projectId: number, id: number) {
  const { data } = await api(`/projects/${projectId}/documents/${id}/lock`, { method: 'POST', schema: lockSchema })
  return data
}

export async function releaseLock(projectId: number, id: number) {
  await api(`/projects/${projectId}/documents/${id}/unlock`, { method: 'POST' })
}

/** A write the server accepted but did not keep (found by reading the answer back). */
function notKept(what: string): ApiError {
  return new ApiError({ status: 200, code: 'NOT_PERSISTED', message: `The server did not keep the ${what}.`, details: { what } })
}
