import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { loginResultSchema } from '@/api/schemas/auth'
import {
  copyResultSchema,
  milestoneSchema,
  projectDetailSchema,
  projectQuestionSchema,
} from '@/api/schemas/projectDetail'
import { projectListItemSchema } from '@/api/schemas/project'

/**
 * Write contract test for the project lifecycle. It CREATES data, so it is opt-in:
 *
 *   CONTRACT_WRITE=1 CONTRACT_EMAIL=... CONTRACT_PASSWORD=... npm run test:contract
 *
 * It makes two projects titled "[contract-test] ...", exercises every Projects endpoint the UI uses,
 * and ends with both projects in the trash (the backend purges trash after 30 days).
 */
const BASE = process.env.CONTRACT_BASE_URL ?? 'http://127.0.0.1:8000'
const EMAIL = process.env.CONTRACT_EMAIL
const PASSWORD = process.env.CONTRACT_PASSWORD
const WRITE = process.env.CONTRACT_WRITE === '1'

const reachable = await fetch(`${BASE}/up`).then(
  (r) => r.ok,
  () => false,
)

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`project lifecycle (${BASE})`, () => {
  let token = ''
  const stamp = new Date().toISOString().slice(0, 19)
  let a = 0
  let b = 0

  async function call(method: string, path: string, body?: unknown) {
    const res = await fetch(`${BASE}/api/v1${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    return { status: res.status, body: (text ? JSON.parse(text) : {}) as Record<string, any> }
  }

  it('signs in', async () => {
    const r = await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })
    const parsed = loginResultSchema.parse(r.body.data)
    token = (parsed as { token: string }).token
    expect(token).not.toBe('')
  })

  it('creates a project exactly as the form sends it', async () => {
    const r = await call('POST', '/projects', {
      title: `[contract-test] A ${stamp}`,
      question: 'Does the contract hold?',
      scope: 'Contract testing only.',
      languages: ['ar', 'en'],
      primary_language: 'ar',
      stage: 'collecting',
      tags: ['contract', 'test'],
    })
    expect(r.status).toBe(201)
    const p = projectDetailSchema.parse(r.body.data)
    a = p.id
    expect(p.stage).toBe('collecting')
    expect(p.languages).toEqual(['ar', 'en'])
    expect(p.tags).toEqual(['contract', 'test'])
  })

  it('shows the new project in the owned tab with counts and next action fields', async () => {
    const r = await call('GET', '/projects?scope=owned&per_page=100')
    const rows = z.array(projectListItemSchema).parse(r.body.data)
    const mine = rows.find((p) => p.id === a)
    expect(mine?.my_role).toBe('owner')
    expect(mine?.tags).toEqual(['contract', 'test'])
  })

  it('changes the stage backwards with a rationale and reads it back', async () => {
    expect((await call('PATCH', `/projects/${a}/stage`, { stage: 'scoping', rationale: 'contract test' })).status).toBe(200)
    const r = await call('GET', `/projects/${a}`)
    expect(projectDetailSchema.parse(r.body.data).stage).toBe('scoping')
  })

  it('edits the details', async () => {
    const r = await call('PATCH', `/projects/${a}`, { title: `[contract-test] A renamed ${stamp}`, question: 'Still holds?', scope: 'Edited.' })
    expect(r.status).toBe(200)
    expect(projectDetailSchema.parse(r.body.data).title).toContain('renamed')
  })

  it('adds a milestone and a question, and lists them', async () => {
    const m = await call('POST', `/projects/${a}/milestones`, { title: 'Draft', due_date: '2026-12-01', progress_mode: 'manual', manual_percent: 10 })
    expect(m.status).toBe(201)
    milestoneSchema.parse(m.body.data)
    const q = await call('POST', `/projects/${a}/questions`, { text: 'Which edition?' })
    expect(q.status).toBe(201)
    projectQuestionSchema.parse(q.body.data)

    const lm = z.array(milestoneSchema).parse((await call('GET', `/projects/${a}/milestones`)).body.data)
    expect(lm[0]?.manual_percent).toBe(10)
    const lq = z.array(projectQuestionSchema).parse((await call('GET', `/projects/${a}/questions`)).body.data)
    expect(lq[0]?.resolved ?? false).toBe(false)
  })

  it('archives (toggle) and unarchives, and the tabs follow', async () => {
    expect((await call('POST', `/projects/${a}/archive`)).status).toBe(200)
    const archived = await call('GET', '/projects?scope=archived&per_page=100')
    expect(archived.body.data.some((p: { id: number }) => p.id === a)).toBe(true)
    expect((await call('POST', `/projects/${a}/archive`)).status).toBe(200)
    const owned = await call('GET', '/projects?scope=owned&per_page=100')
    expect(owned.body.data.some((p: { id: number }) => p.id === a)).toBe(true)
  })

  it('copies a saved query to a second project', async () => {
    b = projectDetailSchema.parse(
      (
        await call('POST', '/projects', {
          title: `[contract-test] B ${stamp}`,
          question: 'Destination',
          scope: 'Contract testing only.',
          languages: ['en'],
          stage: 'scoping',
          tags: [],
        })
      ).body.data,
    ).id
    const sq = await call('POST', `/projects/${a}/searches`, { name: 'contract query', query_text: 'الوضوء', search_mode: 'normalized' })
    expect(sq.status).toBe(201)
    const preview = await call('POST', `/projects/${a}/copy-preview`, { target_project_id: b, items: [{ type: 'saved_query', id: sq.body.data.id }] })
    expect(preview.status).toBe(200)
    const copied = copyResultSchema.parse((await call('POST', `/projects/${a}/copy`, { target_project_id: b, items: [{ type: 'saved_query', id: sq.body.data.id }] })).body.data)
    expect(copied[0]?.status).toBe('copied')
  })

  it('trashes both, lists them in trash with a recovery deadline, restores one, and trashes it again', async () => {
    expect((await call('DELETE', `/projects/${a}`)).status).toBe(200)
    expect((await call('DELETE', `/projects/${b}`)).status).toBe(200)
    const trash = z.array(projectListItemSchema).parse((await call('GET', '/projects?scope=trash&per_page=100')).body.data)
    const row = trash.find((p) => p.id === a)
    expect(row?.recovery_deadline).toBeTruthy()

    expect((await call('POST', `/projects/${a}/restore`)).status).toBe(200)
    expect((await call('GET', `/projects/${a}`)).status).toBe(200)
    expect((await call('DELETE', `/projects/${a}`)).status).toBe(200)
  })

  it('leaves no contract-test project outside the trash', async () => {
    const owned = await call('GET', '/projects?scope=owned&per_page=100')
    expect(owned.body.data.filter((p: { title: string }) => p.title.startsWith('[contract-test]'))).toEqual([])
  })
})
