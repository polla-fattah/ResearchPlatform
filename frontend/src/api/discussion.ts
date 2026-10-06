import { z } from 'zod'
import { ApiError } from './errors'
import { api } from './http'
import { commentSchema, taskSchema, threadSchema, type TargetType, type TaskStatus } from './schemas/discussion'

const notKept = (what: string) =>
  new ApiError({ status: 200, code: 'NOT_PERSISTED', message: `The server did not keep the ${what}.`, details: { what } })

/** The server's date column answers a full timestamp; the screen works with the day. */
export const dayOf = (value: string | null | undefined) => (value ? value.slice(0, 10) : '')

// ── discussions ───────────────────────────────────────────────────────────────────────────────────────────────
export const THREADS_PER_PAGE = 50

/** Every thread of the project, newest activity first. Filtering by state is done on the page that is loaded. */
export async function listThreads(projectId: number, page = 1, signal?: AbortSignal) {
  const res = await api(`/projects/${projectId}/discussions`, {
    query: { page, per_page: THREADS_PER_PAGE },
    schema: z.array(threadSchema),
    signal,
  })
  return { items: res.data, pagination: res.pagination }
}

/** The discussions about one item (an evidence item, a finding): the server filters by target. */
export async function listThreadsAbout(projectId: number, type: TargetType, id: number, signal?: AbortSignal) {
  const res = await api(`/projects/${projectId}/discussions`, {
    query: { target_type: type, target_id: id, per_page: 10 },
    schema: z.array(threadSchema),
    signal,
  })
  return { items: res.data, total: res.pagination?.total_items ?? res.data.length }
}

export interface NewThread {
  title: string
  target_type: TargetType
  target_id: number
  initial_comment: string
  context_quote?: string
}

export async function createThread(projectId: number, input: NewThread) {
  const { data } = await api(`/projects/${projectId}/discussions`, {
    method: 'POST',
    body: { ...input, context_quote: input.context_quote || undefined },
    schema: threadSchema,
  })
  if (data.title !== input.title) throw notKept('title')
  return data
}

export const COMMENTS_PER_PAGE = 50

export async function listComments(threadId: number, page = 1, signal?: AbortSignal) {
  const res = await api(`/discussions/${threadId}/comments`, {
    query: { page, per_page: COMMENTS_PER_PAGE },
    schema: z.array(commentSchema),
    signal,
  })
  return { items: res.data, pagination: res.pagination }
}

export async function addComment(threadId: number, content: string) {
  const { data } = await api(`/discussions/${threadId}/comments`, { method: 'POST', body: { content }, schema: commentSchema })
  if (data.content !== content) throw notKept('reply')
  return data
}

export async function resolveThread(threadId: number, input: { resolution_notes: string; alternative_interpretation?: string }) {
  const { data } = await api(`/discussions/${threadId}/resolve`, {
    method: 'POST',
    body: { resolution_notes: input.resolution_notes, alternative_interpretation: input.alternative_interpretation || undefined },
    schema: threadSchema,
  })
  if (!data.is_resolved) throw notKept('decision')
  return data
}

// ── tasks ─────────────────────────────────────────────────────────────────────────────────────────────────────
export const TASKS_PER_PAGE = 20

export interface TaskQuery {
  status?: TaskStatus
  assignee_id?: number
  page?: number
}

export async function listTasks(projectId: number, query: TaskQuery = {}, signal?: AbortSignal) {
  const res = await api(`/projects/${projectId}/tasks`, {
    query: { ...query, per_page: TASKS_PER_PAGE },
    schema: z.array(taskSchema),
    signal,
  })
  return { items: res.data, pagination: res.pagination }
}

export interface TaskFields {
  title: string
  description?: string | null
  assignee_id?: number | null
  due_date?: string | null
}

export async function createTask(projectId: number, input: TaskFields) {
  const { data } = await api(`/projects/${projectId}/tasks`, { method: 'POST', body: input, schema: taskSchema })
  if (data.title !== input.title) throw notKept('title')
  if ((input.assignee_id ?? null) !== (data.assignee_id ?? null)) throw notKept('assignee')
  return data
}

/** Title, description, assignee, due date and the two states that need no extra information (open, in progress). */
export async function updateTask(projectId: number, taskId: number, input: TaskFields & { status?: 'open' | 'in_progress' }) {
  const { data } = await api(`/projects/${projectId}/tasks/${taskId}`, { method: 'PATCH', body: input, schema: taskSchema })
  if (data.title !== input.title) throw notKept('title')
  if (input.status && data.status !== input.status) throw notKept('state')
  if ((input.assignee_id ?? null) !== (data.assignee_id ?? null)) throw notKept('assignee')
  if (dayOf(input.due_date) !== dayOf(data.due_date)) throw notKept('due date')
  return data
}

export async function completeTask(projectId: number, taskId: number) {
  const { data } = await api(`/projects/${projectId}/tasks/${taskId}/complete`, { method: 'POST', schema: taskSchema })
  if (data.status !== 'done') throw notKept('state')
  return data
}

export async function blockTask(projectId: number, taskId: number, reason: string) {
  const { data } = await api(`/projects/${projectId}/tasks/${taskId}/block`, { method: 'POST', body: { blocking_reason: reason }, schema: taskSchema })
  if (data.status !== 'blocked') throw notKept('state')
  return data
}
