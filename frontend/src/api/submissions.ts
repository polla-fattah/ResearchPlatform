import { z } from 'zod'
import { ApiError } from './errors'
import { api } from './http'
import { createdSubmissionSchema, submissionSchema, validationSchema } from './schemas/submission'

export async function listSubmissions(projectId: number, signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/submissions`, { schema: z.array(submissionSchema), signal })
  return data
}

/** What stops these documents from being published. An empty list of ids means every document, so the screen never sends one. */
export async function validatePrePublication(projectId: number, documentIds: readonly number[], signal?: AbortSignal) {
  const { data } = await api(`/projects/${projectId}/validate-pre-publication`, { method: 'POST', body: { document_ids: documentIds }, schema: validationSchema, signal })
  return data
}

export interface NewSubmission {
  title: string
  abstract: string
  document_ids: number[]
  keywords: string[]
  rights_declaration: string
  /** Set for a response to a revision request: the package it answers, and what the author says. */
  parent_submission_id?: number
  author_response_notes?: string
}

/**
 * Freezes the package and submits it. Every choice is sent explicitly (the server fills in a licence and a conflict-of-
 * interest declaration when they are missing), and `bypass_warnings` is never sent: it would let a submission past
 * errors too (request file C-29). The answer is checked against what was sent.
 */
export async function createSubmission(projectId: number, input: NewSubmission) {
  const { data } = await api(`/projects/${projectId}/submissions`, {
    method: 'POST',
    body: { ...input, coi_declared: true },
    schema: createdSubmissionSchema,
  })
  if (data.title !== input.title) {
    throw new ApiError({ status: 200, code: 'NOT_PERSISTED', message: 'The server did not keep the title.', details: { what: 'title' } })
  }
  return data
}
