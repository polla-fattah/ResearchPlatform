import { z } from 'zod'
import { api } from './http'
import {
  projectCountsSchema,
  projectListItemSchema,
  type ProjectCounts,
  type ProjectScope,
} from './schemas/project'

export interface ListProjectsParams {
  scope?: ProjectScope
  stage?: string
  q?: string
  tag?: string
  page?: number
  per_page?: number
}

export const projectKeys = {
  all: ['projects'] as const,
  list: (p: ListProjectsParams) => ['projects', 'list', p] as const,
}

export async function listProjects(params: ListProjectsParams = {}, signal?: AbortSignal) {
  const res = await api('/projects', {
    query: { ...params },
    schema: z.array(projectListItemSchema),
    signal,
  })
  const counts = projectCountsSchema.safeParse(res.meta.counts)
  return {
    items: res.data,
    pagination: res.pagination,
    counts: (counts.success ? counts.data : null) as ProjectCounts | null,
  }
}
