import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { savedQuerySchema } from '@/api/schemas/search'

/**
 * Contract test for the account's own saved searches (screen 08s): create, list, rename, change, delete, and what the
 * server refuses. Everything it creates is deleted again. Opt-in for the write part:
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

let token = ''
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

describe.skipIf(!reachable || !EMAIL || !PASSWORD)(`personal saved searches, read (${BASE})`, () => {
  it('lists the account’s own saved searches, paginated, with the saved-query schema', async () => {
    token = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    const res = await call('GET', '/saved-searches')
    expect(res.status).toBe(200)
    z.array(savedQuerySchema).parse(res.body.data)
    expect(res.body.meta.pagination).toMatchObject({ current_page: 1 })
  })
})

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`personal saved searches, write (${BASE})`, () => {
  let id = 0

  it('saves a search with its text, mode and filters, and returns it as the account’s own', async () => {
    token = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    const res = await call('POST', '/saved-searches', {
      name: '[contract-test] saved search',
      query_text: 'إنما الأعمال',
      search_mode: 'exact',
      filter_criteria: { hukm_id: 6, narrator_id: 31544, narrator_label: 'Narrator' },
    })
    expect(res.status).toBe(201)
    const saved = savedQuerySchema.parse(res.body.data)
    id = saved.id
    expect(saved).toMatchObject({ owner_type: 'user', search_mode: 'exact', query_text: 'إنما الأعمال' })
    expect(saved.filter_criteria).toMatchObject({ hukm_id: 6, narrator_id: 31544, narrator_label: 'Narrator' })
  })

  it('lists it, newest first, and not in any project’s searches', async () => {
    const mine = z.array(savedQuerySchema).parse((await call('GET', '/saved-searches?per_page=100')).body.data)
    expect(mine[0]!.id).toBe(id)
    const projects = (await call('GET', '/projects?scope=owned&per_page=100')).body.data as { id: number }[]
    for (const p of projects.slice(0, 3)) {
      const inProject = (await call('GET', `/projects/${p.id}/searches?per_page=100`)).body.data as { id: number }[]
      expect(inProject.map((q) => q.id)).not.toContain(id)
    }
  })

  it('renames it, and changes its text and filters', async () => {
    const renamed = await call('PATCH', `/saved-searches/${id}`, { name: '[contract-test] renamed' })
    expect(renamed.status).toBe(200)
    expect(savedQuerySchema.parse(renamed.body.data).name).toBe('[contract-test] renamed')
    const changed = await call('PATCH', `/saved-searches/${id}`, { query_text: 'نية', search_mode: 'normalized', filter_criteria: {} })
    expect(changed.status).toBe(200)
    const shown = z.array(savedQuerySchema).parse((await call('GET', '/saved-searches?per_page=100')).body.data).find((q) => q.id === id)!
    expect(shown).toMatchObject({ name: '[contract-test] renamed', query_text: 'نية', search_mode: 'normalized' })
  })

  it('refuses a missing name, a text that is too short, and a mode it does not know', async () => {
    expect((await call('POST', '/saved-searches', { query_text: 'نية' })).status).toBe(422)
    expect((await call('POST', '/saved-searches', { name: 'x', query_text: 'ن' })).status).toBe(422)
    expect((await call('POST', '/saved-searches', { name: 'x', query_text: 'نية', search_mode: 'regex' })).status).toBe(422)
    expect((await call('PATCH', `/saved-searches/${id}`, { name: '' })).status).toBe(422)
  })

  it('answers 404 for a search that is not the account’s', async () => {
    expect((await call('PATCH', '/saved-searches/99999999', { name: 'x' })).status).toBe(404)
    expect((await call('DELETE', '/saved-searches/99999999')).status).toBe(404)
  })

  it.fails('C-15: a personal search can be run, without any project', async () => {
    const res = await call('POST', `/saved-searches/${id}/run`)
    expect(res.status).toBe(200)
  })

  it('deletes it, and then it is gone', async () => {
    expect((await call('DELETE', `/saved-searches/${id}`)).status).toBe(200)
    expect((await call('PATCH', `/saved-searches/${id}`, { name: 'x' })).status).toBe(404)
    const mine = z.array(savedQuerySchema).parse((await call('GET', '/saved-searches?per_page=100')).body.data)
    expect(mine.map((q) => q.id)).not.toContain(id)
  })
})
