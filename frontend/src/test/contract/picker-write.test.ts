import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { libraryItemSchema } from '@/api/schemas/library'
import { corpusNarratorSchema, corpusSearchHitSchema } from '@/api/schemas/corpus'
import { projectDetailSchema } from '@/api/schemas/projectDetail'
import { toSaveInput, emptyExternalReference } from '@/domain/externalReference'
import { pickableFromNarrator, pickablesFromHit } from '@/domain/pickable'

/**
 * Write contract test for the resource picker: it saves real corpus items exactly as the picker
 * builds them, checks the duplicate (409) behaviour, attaches to a project, and cleans up after
 * itself (library items deleted, project trashed). Opt-in:
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

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`resource picker (${BASE})`, () => {
  let token = ''
  let projectId = 0
  const createdItems: number[] = []
  let resourceId = 0
  let pickedLocator = ''
  let firstItemId = 0
  let pickedPayload: Record<string, unknown> = {}
  let externalItemId = 0
  const stamp = new Date().toISOString().slice(0, 19)

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

  it('signs in and creates a throwaway project', async () => {
    const login = await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })
    token = login.body.data.token
    const p = await call('POST', '/projects', {
      title: `[contract-test] picker ${stamp}`,
      question: 'Picker contract',
      scope: 'Contract testing only.',
      languages: ['ar'],
      stage: 'scoping',
      tags: [],
    })
    projectId = projectDetailSchema.parse(p.body.data).id
    expect(projectId).toBeGreaterThan(0)
  })

  it('saves an occurrence built from a real search hit, then 409s on the same occurrence', async () => {
    // Page 7 keeps us away from items the demo library already holds.
    const search = await call('GET', `/corpus/search?q=${encodeURIComponent('الوضوء')}&per_page=10&page=7`)
    const hits = z.array(corpusSearchHitSchema).parse(search.body.data)
    const picks = hits.flatMap(pickablesFromHit).filter((p) => p.kind === 'occurrence')
    expect(picks.length).toBeGreaterThan(0)
    const pick = picks[0]!

    const payload = { ...pick.save, locator: pick.locator, incomplete_citation_flags: pick.gaps }
    const first = await call('POST', '/library/items', payload)
    expect(first.status).toBe(201)
    const item = libraryItemSchema.parse(first.body.data)
    createdItems.push(item.id)
    resourceId = item.resource_id
    expect(item.resource.corpus_table).toBe('hadith_references')
    expect(item.resource.corpus_id).toBe(pick.corpusId)
    pickedLocator = pick.locator
    firstItemId = item.id

    const again = await call('POST', '/library/items', payload)
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('DUPLICATE')
    expect(libraryItemSchema.parse(again.body.error.details.existing_item).id).toBe(item.id)

    pickedPayload = payload
  })

  it('adds the resource to the project (idempotently) and lists it there', async () => {
    expect((await call('POST', `/projects/${projectId}/resources`, { resource_id: resourceId })).status).toBe(201)
    expect((await call('POST', `/projects/${projectId}/resources`, { resource_id: resourceId })).status).toBe(201)
    const list = await call('GET', `/projects/${projectId}/resources`)
    const ids = (list.body.data as { id: number }[]).map((r) => r.id)
    expect(ids.filter((id) => id === resourceId)).toHaveLength(1)
  })

  it('saves a narrator as an identity record', async () => {
    const found = await call('GET', `/corpus/narrators?q=${encodeURIComponent('مالك')}&per_page=3`)
    const narrators = z.array(corpusNarratorSchema).parse(found.body.data)
    const pick = pickableFromNarrator(narrators[0]!)
    const saved = await call('POST', '/library/items', { ...pick.save, locator: pick.locator })
    expect([201, 409]).toContain(saved.status) // a 409 means the demo library already holds this narrator
    if (saved.status === 201) createdItems.push(libraryItemSchema.parse(saved.body.data).id)
    else expect(saved.body.error.code).toBe('DUPLICATE')
  })

  it('saves an incomplete external reference with its flags and metadata', async () => {
    const form = { ...emptyExternalReference('2026-10-06'), title: `[contract-test] article ${stamp}`, dateUnknown: true }
    const saved = await call('POST', '/library/items', toSaveInput(form))
    expect(saved.status).toBe(201)
    const item = libraryItemSchema.parse(saved.body.data)
    createdItems.push(item.id)
    externalItemId = item.id
    expect(saved.body.data.resource.source_metadata).toMatchObject({ kind: 'article', date_unknown: true })
  })

  // C-13 (b): saving a second excerpt of the same source answers HTTP 500 because library_items has a
  // unique (user_id, resource_id) constraint (uq_user_resource), so LIB-07 cannot work yet.
  it.fails('C-13: a distinct excerpt of an already-saved source can be saved', async () => {
    const distinct = await call('POST', '/library/items', {
      ...pickedPayload,
      excerpt_text: 'selected passage',
      locator: 'selected passage',
      allow_duplicate_excerpt: true,
    })
    if (distinct.status === 201) createdItems.push(libraryItemSchema.parse(distinct.body.data).id)
    expect(distinct.status).toBe(201)
    expect(distinct.body.data.excerpt_text).toBe('selected passage')
  })

  // C-13 (a): LibraryItem::$fillable omits these columns, so mass assignment drops them
  // silently. `it.fails` passes while that is true and starts failing when the backend is fixed.
  it.fails('C-13: locator, excerpt, snapshot and citation flags are actually stored', async () => {
    const first = await call('GET', `/library/items/${firstItemId}`)
    expect(first.body.data.locator).toBe(pickedLocator)
    const external = await call('GET', `/library/items/${externalItemId}`)
    expect(external.body.data.incomplete_citation_flags).toEqual([
      'author',
      'publication date (marked unknown)',
      'publisher or journal',
      'pages',
    ])
  })

  it('cleans up: deletes the library items it created and trashes the project', async () => {
    for (const id of createdItems) expect((await call('DELETE', `/library/items/${id}`)).status).toBe(200)
    expect((await call('DELETE', `/projects/${projectId}/resources/${resourceId}`)).status).toBe(200)
    expect((await call('DELETE', `/projects/${projectId}`)).status).toBe(200)
  })
})
