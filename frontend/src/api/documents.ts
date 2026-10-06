import { z } from 'zod'
import { api } from './http'
import {
  citePreviewSchema,
  documentSchema,
  documentVersionSchema,
  draftResponseSchema,
  type CitePreview,
  type DocumentItem,
  type DocumentVersion,
  type DraftResponse,
} from './schemas/documents'

export type { CitePreview, DocumentItem, DocumentVersion, DraftResponse }

export const documentKeys = {
  all: (projectId: number) => ['projects', projectId, 'documents'] as const,
  list: (projectId: number, q?: string) => ['projects', projectId, 'documents', { q }] as const,
  detail: (projectId: number, id: number) => ['projects', projectId, 'documents', id] as const,
  draft: (projectId: number, id: number) => ['projects', projectId, 'documents', id, 'draft'] as const,
  versions: (projectId: number, id: number) => ['projects', projectId, 'documents', id, 'versions'] as const,
  version: (projectId: number, id: number, v: number) =>
    ['projects', projectId, 'documents', id, 'versions', v] as const,
}

export interface CreateDocumentPayload {
  title: string
  content: string
  document_type?: 'article' | 'dossier' | 'dataset_note'
  language?: string
  change_summary?: string
}

export interface CreateVersionPayload {
  content: string
  change_summary?: string
  expected_version?: number
  citations?: Array<{
    resource_id: number
    evidence_id?: number
    locator?: string
    citation_type?: 'direct_quotation' | 'paraphrase' | 'reference'
    formatted_citation: string
  }>
}

export interface CiteEvidencePayload {
  evidence_id: number
  mode?: 'direct_quotation' | 'paraphrase' | 'reference'
  style?: string
}

export async function listDocuments(
  projectId: number,
  params?: { q?: string; per_page?: number },
  signal?: AbortSignal,
) {
  const { data } = await api(`/projects/${projectId}/documents`, {
    query: params,
    schema: z.array(documentSchema),
    signal,
  })
  return data
}

export async function getDocument(projectId: number, id: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/documents/${id}`, {
    schema: documentSchema,
    signal,
  })
  return data
}

export async function createDocument(
  projectId: number,
  payload: CreateDocumentPayload,
  signal?: AbortSignal,
) {
  const { data } = await api(`/projects/${projectId}/documents`, {
    method: 'POST',
    body: payload,
    schema: documentSchema,
    signal,
  })
  return data
}

export async function updateDocument(
  projectId: number,
  id: number,
  payload: { title?: string; document_type?: string; language?: string },
  signal?: AbortSignal,
) {
  const { data } = await api(`/projects/${projectId}/documents/${id}`, {
    method: 'PUT',
    body: payload,
    schema: documentSchema,
    signal,
  })
  return data
}

export async function deleteDocument(projectId: number, id: number, signal?: AbortSignal) {
  await api(`/projects/${projectId}/documents/${id}`, {
    method: 'DELETE',
    signal,
  })
}

export async function saveDocumentDraft(
  projectId: number,
  id: number,
  payload: { content: string; base_version?: number },
  signal?: AbortSignal,
) {
  const { data } = await api(`/projects/${projectId}/documents/${id}/draft`, {
    method: 'PUT',
    body: payload,
    schema: z.object({
      last_saved_at: z.string().nullable().optional(),
      saved_by: z.string().optional(),
      draft_base_version: z.number().nullable().optional(),
    }),
    signal,
  })
  return data
}

export async function getDocumentDraft(projectId: number, id: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/documents/${id}/draft`, {
    schema: draftResponseSchema,
    signal,
  })
  return data
}

export async function createDocumentVersion(
  projectId: number,
  id: number,
  payload: CreateVersionPayload,
  signal?: AbortSignal,
) {
  const { data } = await api(`/projects/${projectId}/documents/${id}/versions`, {
    method: 'POST',
    body: payload,
    schema: documentVersionSchema,
    signal,
  })
  return data
}

export async function restoreDocumentVersion(
  projectId: number,
  id: number,
  versionNumber: number,
  signal?: AbortSignal,
) {
  const { data } = await api(`/projects/${projectId}/documents/${id}/versions/${versionNumber}/restore`, {
    method: 'POST',
    schema: documentVersionSchema,
    signal,
  })
  return data
}

export async function listDocumentVersions(projectId: number, id: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/documents/${id}/versions`, {
    schema: z.array(documentVersionSchema),
    signal,
  })
  return data
}

export async function getDocumentVersion(
  projectId: number,
  id: number,
  versionNumber: number,
  signal?: AbortSignal,
) {
  const { data } = await api(`/projects/${projectId}/documents/${id}/versions/${versionNumber}`, {
    schema: documentVersionSchema,
    signal,
  })
  return data
}

export async function citeEvidence(
  projectId: number,
  id: number,
  payload: CiteEvidencePayload,
  signal?: AbortSignal,
) {
  const { data } = await api(`/projects/${projectId}/documents/${id}/cite`, {
    method: 'POST',
    body: payload,
    schema: citePreviewSchema,
    signal,
  })
  return data
}

export async function linkFindingToDocument(
  projectId: number,
  id: number,
  findingId: number,
  signal?: AbortSignal,
) {
  const { data } = await api(`/projects/${projectId}/documents/${id}/findings/${findingId}`, {
    method: 'POST',
    schema: documentSchema,
    signal,
  })
  return data
}

export async function unlinkFindingFromDocument(
  projectId: number,
  id: number,
  findingId: number,
  signal?: AbortSignal,
) {
  const { data } = await api(`/projects/${projectId}/documents/${id}/findings/${findingId}`, {
    method: 'DELETE',
    schema: documentSchema,
    signal,
  })
  return data
}
