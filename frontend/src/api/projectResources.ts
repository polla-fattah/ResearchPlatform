import { z } from 'zod'
import { api } from './http'
import { projectCollectionSchema, projectResourceSchema } from './schemas/projectResources'

export async function listProjectResources(projectId: number, page = 1, signal?: AbortSignal) {
  const res = await api(`/projects/${projectId}/resources`, {
    query: { page, per_page: 50 },
    schema: z.array(projectResourceSchema),
    signal,
  })
  return { items: res.data, pagination: res.pagination }
}

export async function removeProjectResource(projectId: number, resourceId: number) {
  await api(`/projects/${projectId}/resources/${resourceId}`, { method: 'DELETE' })
}

export async function listProjectCollections(projectId: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/resource-collections`, {
    schema: z.array(projectCollectionSchema),
    signal,
  })
  return data
}

export async function createProjectCollection(projectId: number, name: string) {
  const { data } = await api(`/projects/${projectId}/resource-collections`, {
    method: 'POST',
    body: { name },
    schema: projectCollectionSchema,
  })
  return data
}
