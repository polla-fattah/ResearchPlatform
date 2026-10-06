import { z } from 'zod'
import { api } from './http'
import {
  copyPreviewSchema,
  copyResultSchema,
  milestoneSchema,
  projectDetailSchema,
  projectQuestionSchema,
  projectSummarySchema,
  type CopyItem,
  type CreateProjectInput,
  type MilestoneInput,
} from './schemas/projectDetail'

export const projectDetailKeys = {
  detail: (id: number) => ['projects', 'detail', id] as const,
  summary: (id: number) => ['projects', 'summary', id] as const,
  milestones: (id: number) => ['projects', 'milestones', id] as const,
  questions: (id: number) => ['projects', 'questions', id] as const,
  picker: (id: number, kind: string) => ['projects', 'copy-picker', id, kind] as const,
}

export async function getProject(id: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${id}`, { schema: projectDetailSchema, signal })
  return data
}

export async function createProject(input: CreateProjectInput) {
  const { data } = await api('/projects', {
    method: 'POST',
    body: {
      title: input.title,
      question: input.question,
      scope: input.scope,
      languages: input.languages,
      primary_language: input.languages[0],
      stage: input.stage,
      tags: input.tags,
    },
    schema: projectDetailSchema,
  })
  return data
}

export async function updateProject(
  id: number,
  patch: { title?: string; question?: string; scope?: string },
) {
  const { data } = await api(`/projects/${id}`, {
    method: 'PATCH',
    body: patch,
    schema: projectDetailSchema,
  })
  return data
}

/** Moving backwards is allowed; the backend logs every change to the activity feed. */
export async function setStage(id: number, stage: string, rationale?: string) {
  await api(`/projects/${id}/stage`, { method: 'PATCH', body: { stage, rationale } })
}

/** POST /archive toggles; callers must know the current state and refetch afterwards. */
export async function toggleArchive(id: number) {
  await api(`/projects/${id}/archive`, { method: 'POST' })
}

export async function trashProject(id: number) {
  await api(`/projects/${id}`, { method: 'DELETE' })
}

export async function restoreProject(id: number) {
  await api(`/projects/${id}/restore`, { method: 'POST' })
}

export async function leaveProject(id: number) {
  await api(`/projects/${id}/leave`, { method: 'POST' })
}

export async function getProjectSummary(id: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${id}/summary`, { schema: projectSummarySchema, signal })
  return data
}

export async function listMilestones(id: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${id}/milestones`, {
    schema: z.array(milestoneSchema),
    signal,
  })
  return data
}

export async function addMilestone(id: number, input: MilestoneInput) {
  const { data } = await api(`/projects/${id}/milestones`, {
    method: 'POST',
    body: input,
    schema: milestoneSchema,
  })
  return data
}

export async function listQuestions(id: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${id}/questions`, {
    schema: z.array(projectQuestionSchema),
    signal,
  })
  return data
}

export async function addQuestion(id: number, text: string) {
  const { data } = await api(`/projects/${id}/questions`, {
    method: 'POST',
    body: { text },
    schema: projectQuestionSchema,
  })
  return data
}

export async function copyPreview(id: number, targetProjectId: number, items: CopyItem[]) {
  const { data } = await api(`/projects/${id}/copy-preview`, {
    method: 'POST',
    body: { target_project_id: targetProjectId, items },
    schema: copyPreviewSchema,
  })
  return data
}

export async function copyItems(id: number, targetProjectId: number, items: CopyItem[]) {
  const { data } = await api(`/projects/${id}/copy`, {
    method: 'POST',
    body: { target_project_id: targetProjectId, items },
    schema: copyResultSchema,
  })
  return data
}

// Sources for the "Copy to another project" picker.
const pickable = z.object({ id: z.number(), title: z.string().optional(), name: z.string().optional() })

export async function listCopyableResources(id: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${id}/resources`, {
    query: { per_page: 100 },
    schema: z.array(pickable),
    signal,
  })
  return data
}

export async function listCopyableSearches(id: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${id}/searches`, {
    query: { per_page: 100 },
    schema: z.array(pickable),
    signal,
  })
  return data
}
