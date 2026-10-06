import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { announcementHistorySchema, announcementOrNullSchema, announcementSchema } from '@/api/schemas/announcement'

/**
 * Contract test for the project announcement (screen 19). It creates two throwaway projects owned by the demo account,
 * drafts, publishes and unpublishes an announcement (checking what the public list shows), and trashes both projects.
 * Known backend defects are `it.fails` (request file C-26). WRITTEN FROM THE BACKEND CODE AND NOT YET RUN against a live
 * server (the cloud session has no PHP 8.4). Opt-in for the write part:
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
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`project announcement (${BASE})`, () => {
  const stamp = Date.now()
  const slug = `contract-test-${stamp}`
  let owner = ''
  let a = 0
  let b = 0

  const asOwner = (method: string, project: number, path: string, body?: unknown) => call(method, `/projects/${project}${path}`, body, owner)
  const fields = (over: Record<string, unknown> = {}) => ({ public_slug: slug, title: `[contract-test] ${stamp}`, summary: 'Ongoing research.', research_stage: 'analysing', keywords: ['isnad', 'test'], ...over })
  const publicList = async () => z.array(z.object({ public_slug: z.string() }).passthrough()).parse((await call('GET', '/public/announcements?per_page=100')).body.data)

  it('sets up two projects; one has no announcement yet', async () => {
    owner = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    const make = async (n: string) => (await call('POST', '/projects', { title: `[contract-test] announce ${n} ${stamp}`, question: 'Announce?', scope: 'Contract testing only.', languages: ['en'], stage: 'scoping', tags: [] }, owner)).body.data.id as number
    a = await make('A')
    b = await make('B')
    const res = await asOwner('GET', a, '/announcement')
    expect(res.status).toBe(200)
    expect(announcementOrNullSchema.parse(res.body.data)).toBeNull()
  })

  it('refuses a draft without a title, a summary, a stage or an address', async () => {
    expect((await asOwner('POST', a, '/announcement', fields({ title: '' }))).status).toBe(422)
    expect((await asOwner('POST', a, '/announcement', fields({ summary: '' }))).status).toBe(422)
    expect((await asOwner('POST', a, '/announcement', fields({ research_stage: '' }))).status).toBe(422)
    expect((await asOwner('POST', a, '/announcement', fields({ public_slug: '' }))).status).toBe(422)
  })

  it('saves a draft with every field kept, and a draft is not on the public list', async () => {
    const res = await asOwner('POST', a, '/announcement', { ...fields(), status: 'draft' })
    expect(res.status).toBe(200)
    const saved = announcementSchema.parse(res.body.data)
    expect(saved).toMatchObject({ public_slug: slug, status: 'draft', keywords: ['isnad', 'test'], published_at: null })
    expect((await publicList()).some((x) => x.public_slug === slug)).toBe(false)
  })

  it('publishes it, and the public list and page show only the whitelisted fields', async () => {
    expect((await asOwner('POST', a, '/announcement/publish')).status).toBe(200)
    const list = await publicList()
    expect(list.some((x) => x.public_slug === slug)).toBe(true)
    const page = await call('GET', `/public/announcements/${slug}`)
    expect(page.status).toBe(200)
    const text = JSON.stringify(page.body.data)
    expect(text).not.toContain(EMAIL!)
    expect(page.body.data.project).not.toHaveProperty('owner_id')
  })

  it('unpublishes it, and the public page then answers 404', async () => {
    expect(announcementSchema.parse((await asOwner('POST', a, '/announcement/unpublish')).body.data).status).toBe('unpublished')
    expect((await call('GET', `/public/announcements/${slug}`)).status).toBe(404)
    expect((await publicList()).some((x) => x.public_slug === slug)).toBe(false)
  })

  it('records that it was taken down in the history', async () => {
    const res = await asOwner('GET', a, '/announcement/history')
    const history = announcementHistorySchema.parse(res.body.data).history
    expect(history.some((h) => h.action === 'announcement_unpublished')).toBe(true)
  })

  it.fails('C-26: saving without a status keeps the status the announcement has', async () => {
    await asOwner('POST', a, '/announcement/publish')
    const res = await asOwner('POST', a, '/announcement', fields({ title: `[contract-test] revised ${stamp}` }))
    expect(announcementSchema.parse(res.body.data).status).toBe('published')
    await asOwner('POST', a, '/announcement/unpublish')
  })

  it.fails('C-26: an address that is not an address is refused', async () => {
    expect((await asOwner('POST', b, '/announcement', fields({ public_slug: 'not a valid address!!' }))).status).toBe(422)
  })

  it.fails('C-26: two projects cannot take the same address', async () => {
    const res = await asOwner('POST', b, '/announcement', fields())
    expect(res.status).toBe(422)
  })

  it.fails('C-26: publishing and saving are recorded in the history', async () => {
    await asOwner('POST', a, '/announcement/publish')
    const history = announcementHistorySchema.parse((await asOwner('GET', a, '/announcement/history')).body.data).history
    await asOwner('POST', a, '/announcement/unpublish')
    expect(history.some((h) => h.action === 'announcement_published')).toBe(true)
  })

  it.fails('C-26: publishing needs a saved announcement with a title and a summary, and says what is missing', async () => {
    const res = await asOwner('POST', b, '/announcement/publish')
    expect(res.status).toBe(422)
  })

  it('cleans up: unpublishes and trashes both projects', async () => {
    await asOwner('POST', a, '/announcement/unpublish')
    expect((await call('DELETE', `/projects/${a}`, undefined, owner)).status).toBe(200)
    expect((await call('DELETE', `/projects/${b}`, undefined, owner)).status).toBe(200)
  })
})
