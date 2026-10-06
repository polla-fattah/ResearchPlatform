import { z } from 'zod'
import { ApiError } from './errors'
import { api } from './http'
import { templateSchema } from './schemas/templates'

export async function listTemplates(signal?: AbortSignal) {
  const { data } = await api('/project-templates', { schema: z.array(templateSchema), signal })
  return data
}

export interface FromTemplate {
  title: string
  question: string
  primaryLanguage: 'ar' | 'ckb' | 'en'
}

/** What the server answers when a project is made from a template: the new project, without the detail a later read has. */
const createdProjectSchema = z.object({
  id: z.number(),
  title: z.string(),
  question: z.string().nullable().optional(),
  primary_language: z.string().nullable().optional(),
  stage: z.string().nullable().optional(),
})

/**
 * Makes a private project from a template. The server fills in the scope itself ("Instantiated from … template") and the
 * stage (scoping); the person changes both afterwards in the project's settings. The answer is checked against what was
 * sent, so a project that came back with another title or question is reported, not shown as created.
 */
export async function createFromTemplate(templateId: number, input: FromTemplate) {
  const { data } = await api(`/project-templates/${templateId}/instantiate`, {
    method: 'POST',
    body: { title: input.title, custom_question: input.question, primary_language: input.primaryLanguage },
    schema: createdProjectSchema,
  })
  if (data.title !== input.title) throw notKept('title')
  if (input.question && (data.question ?? '') !== input.question) throw notKept('question')
  return data
}

const notKept = (what: string) =>
  new ApiError({ status: 200, code: 'NOT_PERSISTED', message: `The server did not keep the ${what}.`, details: { what } })
