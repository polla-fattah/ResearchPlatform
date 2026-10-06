import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { loginResultSchema, meSchema } from '@/api/schemas/auth'
import { myStatusSchema } from '@/api/schemas/application'
import { exportJobSchema } from '@/api/schemas/exports'
import { libraryCollectionSchema, libraryCountsSchema, libraryItemSchema } from '@/api/schemas/library'
import { projectCollectionSchema, projectResourceSchema } from '@/api/schemas/projectResources'
import { projectCountsSchema, projectListItemSchema } from '@/api/schemas/project'
import {
  milestoneSchema,
  projectDetailSchema,
  projectQuestionSchema,
  projectSummarySchema,
} from '@/api/schemas/projectDetail'

/**
 * Authenticated contract tests. They log in (which creates one API token) and then only READ.
 * Skipped unless CONTRACT_EMAIL and CONTRACT_PASSWORD are set, e.g. the seeded demo account from
 * backend/database/seeders/ScholarlyDemoSeeder.php:
 *
 *   CONTRACT_EMAIL=... CONTRACT_PASSWORD=... npm run test:contract
 *
 * These exist because hand-written mocks cannot catch a backend shape that differs from our
 * schemas (e.g. profile.public_fields is a map here but a list elsewhere).
 */
const BASE = process.env.CONTRACT_BASE_URL ?? 'http://127.0.0.1:8000'
const EMAIL = process.env.CONTRACT_EMAIL
const PASSWORD = process.env.CONTRACT_PASSWORD

const reachable = await fetch(`${BASE}/up`).then(
  (r) => r.ok,
  () => false,
)

describe.skipIf(!reachable || !EMAIL || !PASSWORD)(`authenticated contract (${BASE})`, () => {
  let token = ''

  async function get(path: string) {
    const res = await fetch(`${BASE}/api/v1${path}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
    return { status: res.status, body: (await res.json()) as Record<string, any> }
  }

  it('login returns a session the schemas accept', async () => {
    const res = await fetch(`${BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    })
    const body = (await res.json()) as Record<string, any>
    expect(res.status).toBe(200)
    const parsed = loginResultSchema.parse(body.data)
    expect('token' in parsed).toBe(true)
    token = (parsed as { token: string }).token
  })

  it('GET /auth/me matches meSchema and includes roles, is_admin and mfa_enabled', async () => {
    const { status, body } = await get('/auth/me')
    expect(status).toBe(200)
    const me = meSchema.parse(body.data)
    expect(me.roles?.length).toBeGreaterThan(0)
    expect(typeof me.is_admin).toBe('boolean')
    expect(typeof me.mfa_enabled).toBe('boolean')
  })

  it('GET /applications/my-status matches myStatusSchema', async () => {
    const { status, body } = await get('/applications/my-status')
    expect(status).toBe(200)
    myStatusSchema.parse(body.data)
  })

  it('GET /projects is paginated, has scope counts, and rows match projectListItemSchema', async () => {
    const { status, body } = await get('/projects?per_page=2')
    expect(status).toBe(200)
    expect(body.meta.pagination.per_page).toBe(2)
    projectCountsSchema.parse(body.meta.counts)
    const rows = z.array(projectListItemSchema).parse(body.data)
    expect(rows[0]?.my_role).toBeTruthy()
    expect(rows[0]).toHaveProperty('next_action') // null or { label, target }
  })

  it('the sources Home is built from respond: /me/exports, /me/tasks, /notifications/unread-count', async () => {
    const exportsRes = await get('/me/exports?per_page=3')
    expect(exportsRes.status).toBe(200)
    z.array(exportJobSchema).parse(exportsRes.body.data)

    const tasks = await get('/me/tasks?status=open&per_page=1')
    expect(tasks.status).toBe(200)
    expect(tasks.body.meta.pagination.total_items).toEqual(expect.any(Number))

    const unread = await get('/notifications/unread-count')
    expect(unread.status).toBe(200)
    expect(unread.body.data.unread_count).toEqual(expect.any(Number))
  })

  it('a project loads with detail, summary, milestones and questions the schemas accept', async () => {
    const list = await get('/projects?per_page=1')
    const id = list.body.data[0].id as number
    const detail = await get(`/projects/${id}`)
    expect(detail.status).toBe(200)
    const parsed = projectDetailSchema.parse(detail.body.data)
    expect(parsed.id).toBe(id)
    // Secrets must never ride along with nested users (request file C-8).
    expect(JSON.stringify(detail.body.data)).not.toMatch(/mfa_secret|recovery_codes|password_reset/)

    const sum = await get(`/projects/${id}/summary`)
    expect(sum.status).toBe(200)
    expect(projectSummarySchema.parse(sum.body.data).evidence_counts.total).toEqual(expect.any(Number))

    z.array(milestoneSchema).parse((await get(`/projects/${id}/milestones`)).body.data)
    z.array(projectQuestionSchema).parse((await get(`/projects/${id}/questions`)).body.data)
  })

  it('GET /home responds (was HTTP 500, request file C-5)', async () => {
    expect((await get('/home')).status).toBe(200)
  })

  it('GET /library/items matches libraryItemSchema and reports counts', async () => {
    const { status, body } = await get('/library/items?per_page=50')
    expect(status).toBe(200)
    z.array(libraryItemSchema).parse(body.data)
    expect(libraryCountsSchema.parse(body.meta.counts).total_saved).toBeGreaterThanOrEqual(body.data.length)
    expect(body.meta.pagination.total_items).toEqual(expect.any(Number))
  })

  it('GET /library/collections and /library/tags match their schemas', async () => {
    z.array(libraryCollectionSchema).parse((await get('/library/collections')).body.data)
    z.array(z.string()).parse((await get('/library/tags')).body.data)
  })

  it('library list filters: is_favourite narrows the list', async () => {
    const all = await get('/library/items?per_page=100')
    const fav = await get('/library/items?per_page=100&is_favourite=true')
    expect(fav.status).toBe(200)
    expect(fav.body.data.every((i: { is_favourite: boolean }) => i.is_favourite)).toBe(true)
    expect(fav.body.data.length).toBeLessThanOrEqual(all.body.data.length)
  })

  it('GET /projects/{id}/resources matches projectResourceSchema (tags and reason are on the pivot)', async (ctx) => {
    const list = await get('/projects?scope=owned&per_page=100')
    const withResources = list.body.data.find((p: { resource_count: number }) => p.resource_count > 0)
    if (!withResources) ctx.skip() // needs a project that has resources
    const res = await get(`/projects/${withResources.id}/resources`)
    expect(res.status).toBe(200)
    const rows = z.array(projectResourceSchema).parse(res.body.data)
    expect(rows[0]?.pivot).toBeDefined()
    const cols = await get(`/projects/${withResources.id}/resource-collections`)
    expect(cols.status).toBe(200)
    z.array(projectCollectionSchema).parse(cols.body.data)
  })

  // C-12: a trashed project cannot be opened, so the index cannot offer "View (read-only)".
  it.fails('C-12: GET /projects/{id} returns a trashed project to its owner (read-only)', async (ctx) => {
    const trash = await get('/projects?scope=trash&per_page=1')
    const row = trash.body.data[0]
    if (!row) ctx.skip() // needs a trashed project in the database
    expect((await get(`/projects/${row.id}`)).status).toBe(200)
  })
})
