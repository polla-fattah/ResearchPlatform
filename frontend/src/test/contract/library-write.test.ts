import { describe, expect, it } from 'vitest'
import { libraryItemSchema } from '@/api/schemas/library'

/**
 * Write contract test for My Library management. It saves one throwaway external item, edits it, and
 * deletes it (and its collection) again. Opt-in:
 *
 *   CONTRACT_WRITE=1 CONTRACT_EMAIL=... CONTRACT_PASSWORD=... npm run test:contract
 *
 * What the screen relies on (favourite, collections, delete) must pass. What the backend still drops
 * (tags, notes, request file C-13) is recorded with it.fails, so a backend fix shows up as a failing
 * "expected to fail" test, which is the cue to remove the read-back guard's workaround text.
 */
const BASE = process.env.CONTRACT_BASE_URL ?? 'http://127.0.0.1:8000'
const EMAIL = process.env.CONTRACT_EMAIL
const PASSWORD = process.env.CONTRACT_PASSWORD
const WRITE = process.env.CONTRACT_WRITE === '1'

const reachable = await fetch(`${BASE}/up`).then(
  (r) => r.ok,
  () => false,
)

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`library management (${BASE})`, () => {
  let token = ''
  let itemId = 0
  let resourceId = 0
  let collectionId = 0

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
  const read = async () => libraryItemSchema.parse((await call('GET', `/library/items/${itemId}`)).body.data)

  it('signs in and saves a throwaway external item', async () => {
    token = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    const saved = await call('POST', '/library/items', {
      resource_type: 'external',
      title: `[contract-test] library ${new Date().toISOString().slice(0, 19)}`,
    })
    expect(saved.status).toBe(201)
    itemId = saved.body.data.id
    resourceId = saved.body.data.resource_id
  })

  it('keeps the favourite mark', async () => {
    const res = await call('PATCH', `/library/items/${itemId}`, { is_favourite: true })
    expect(res.status).toBe(200)
    expect((await read()).is_favourite).toBe(true)
  })

  it('creates a collection, shows membership on the item, and removes it again', async () => {
    const col = await call('POST', '/library/collections', { name: '[contract-test] collection' })
    expect(col.status).toBe(201)
    collectionId = col.body.data.id
    expect((await call('POST', `/library/collections/${collectionId}/items`, { resource_id: resourceId })).status).toBe(200)
    expect((await read()).resource.collections?.map((c) => c.id)).toContain(collectionId)
    const filtered = await call('GET', `/library/items?collection_id=${collectionId}`)
    expect(filtered.body.data.map((i: { id: number }) => i.id)).toContain(itemId)
    expect((await call('DELETE', `/library/collections/${collectionId}/items/${resourceId}`)).status).toBe(200)
    expect((await read()).resource.collections ?? []).toEqual([])
  })

  // C-13: tags and notes are accepted with 200 and then silently dropped (not fillable).
  it('C-13: PUT /library/items/{id}/tags keeps the tags', async () => {
    await call('PUT', `/library/items/${itemId}/tags`, { tags: ['contract'] })
    expect((await read()).tags).toEqual(['contract'])
  })

  it('C-13: PATCH /library/items/{id} keeps notes', async () => {
    await call('PATCH', `/library/items/${itemId}`, { notes: [{ text: 'a note' }] })
    expect((await read()).notes?.length).toBe(1)
  })

  it('removes the item and the collection', async () => {
    expect((await call('DELETE', `/library/collections/${collectionId}`)).status).toBe(200)
    expect((await call('DELETE', `/library/items/${itemId}`)).status).toBe(200)
    expect((await call('GET', `/library/items/${itemId}`)).status).toBe(404)
  })
})
