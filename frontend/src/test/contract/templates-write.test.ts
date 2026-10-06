import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { projectDetailSchema } from '@/api/schemas/projectDetail'
import { templateSchema } from '@/api/schemas/templates'

/**
 * Contract test for project templates (screen 37). It lists the templates, reads one, and (opt-in) makes a project from
 * one and trashes it. Known backend defects are `it.fails` (request file C-41). WRITTEN FROM THE BACKEND CODE AND NOT YET
 * RUN against a live server (the cloud session has no PHP 8.4). Opt-in for the write part:
 *
 *   CONTRACT_WRITE=1 CONTRACT_EMAIL=... CONTRACT_PASSWORD=... npm run test:contract
 */
const BASE = process.env.CONTRACT_BASE_URL ?? 'http://127.0.0.1:8000'
const EMAIL = process.env.CONTRACT_EMAIL
const PASSWORD = process.env.CONTRACT_PASSWORD
const WRITE = process.env.CONTRACT_WRITE === '1'

const reachable = await fetch(`${BASE}/up`).then(
  (r) => r.ok,
  () => false,
)

async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let parsed: Record<string, any> = {}
  try {
    parsed = text ? JSON.parse(text) : {}
  } catch {
    parsed = { raw: text.slice(0, 200) }
  }
  return { status: res.status, body: parsed }
}

describe.skipIf(!reachable || !EMAIL || !PASSWORD)(`project templates (${BASE})`, () => {
  let token = ''
  let templates: z.infer<typeof templateSchema>[] = []

  it('signs in and lists the templates in the shape the screen reads', async () => {
    token = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    const res = await call('GET', '/project-templates', undefined, token)
    expect(res.status).toBe(200)
    templates = z.array(templateSchema).parse(res.body.data)
  })

  it('reads one template by id', async () => {
    if (templates.length === 0) return
    const res = await call('GET', `/project-templates/${templates[0]!.id}`, undefined, token)
    expect(templateSchema.parse(res.body.data).id).toBe(templates[0]!.id)
  })

  it('answers 404 for a template that is not there', async () => {
    expect((await call('GET', '/project-templates/999999999', undefined, token)).status).toBe(404)
  })

  it('C-41: the server ships at least one template, so a new installation is not empty', () => {
    expect(templates.length).toBeGreaterThan(0)
  })

  describe.skipIf(!WRITE)('making a project from a template', () => {
    let projectId = 0

    it('creates a private project with the title, question and language given, and the starting tasks', async () => {
      if (templates.length === 0) return
      const t = templates[0]!
      const stamp = Date.now()
      const res = await call('POST', `/project-templates/${t.id}/instantiate`, { title: `[contract-test] template ${stamp}`, custom_question: 'Custom question?', primary_language: 'ckb' }, token)
      expect(res.status).toBe(201)
      const project = res.body.data as { id: number; question: string }
      projectId = project.id
      expect(project.question).toBe('Custom question?')
      const tasks = await call('GET', `/projects/${projectId}/tasks`, undefined, token)
      expect(tasks.body.data.length).toBe(t.default_tasks.filter((x) => (x.title ?? '').trim()).length)
    })

    it('C-41: the new project has its languages set, not left empty', async () => {
      if (!projectId) throw new Error('no project made')
      const project = projectDetailSchema.parse((await call('GET', `/projects/${projectId}`, undefined, token)).body.data)
      expect((project.languages ?? []).length).toBeGreaterThan(0)
    })

    it.fails('C-41: the new project starts at the template’s first recommended stage', async () => {
      const t = templates.find((x) => typeof x.recommended_stages[0] === 'string' && x.recommended_stages[0] !== 'scoping')
      if (!t || !projectId) throw new Error('no template with another first stage')
      const project = projectDetailSchema.parse((await call('GET', `/projects/${projectId}`, undefined, token)).body.data)
      expect(project.stage).toBe(t.recommended_stages[0])
    })

    it('cleans up: trashes the project', async () => {
      if (projectId) expect((await call('DELETE', `/projects/${projectId}`, undefined, token)).status).toBe(200)
    })
  })
})
