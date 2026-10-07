import { describe, expect, it } from 'vitest'
import { libraryItemSchema } from '@/api/schemas/library'

/**
 * Contract test for reference import and uploads (screen 36). The screen reads BibTeX and RIS in the browser and saves each
 * reference with `POST /library/items`; this file checks that call (tags, duplicate answer) and records the gaps in the
 * server's own BibTeX, RIS and upload support as `it.fails` (request file C-43). It leaves ONE orphan row in the shared
 * `resources` table (made by the server's own bibtex import, which has no clean-up). WRITTEN FROM THE BACKEND CODE AND NOT
 * YET RUN against a live server (the cloud session has no PHP 8.4). Opt-in:
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

describe.skipIf(!reachable || !EMAIL || !PASSWORD || !WRITE)(`reference import (${BASE})`, () => {
  const stamp = Date.now()
  let token = ''
  const itemIds: number[] = []
  const as = (method: string, path: string, body?: unknown) => call(method, path, body, token)
  const reference = (title: string) => ({ resource_type: 'external', title, author: 'Ali, M.; Kamal, A.', source_metadata: { cite_key: 'k1', entry_type: 'article', year: '2020' }, tags: [`import 2026-10-07`] })

  it('signs in', async () => {
    token = (await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD })).body.data.token
    expect(token).not.toBe('')
  })

  it('saves a reference to the library with its author, details and a tag, and reads it back', async () => {
    const title = `[contract-test] reference ${stamp}`
    const res = await as('POST', '/library/items', reference(title))
    expect(res.status).toBe(201)
    const item = libraryItemSchema.parse(res.body.data)
    itemIds.push(item.id)
    expect(item.resource.title).toBe(title)
    expect(item.tags).toContain('import 2026-10-07')
    const found = await as('GET', `/library/items?q=${encodeURIComponent(title)}`)
    expect(found.body.data.some((x: { id: number }) => x.id === item.id)).toBe(true)
  })

  it('answers 409 DUPLICATE with the existing item when the same reference is saved again', async () => {
    const res = await as('POST', '/library/items', reference(`[contract-test] reference ${stamp}`))
    expect(res.status).toBe(409)
    expect(res.body.error?.code ?? res.body.code).toBe('DUPLICATE')
  })

  it('C-43: the server’s BibTeX import puts the references in the person’s library', async () => {
    const title = `[contract-test] bibtex ${stamp}`
    const res = await as('POST', '/library/bibtex/import', { bibtex: `@book{k${stamp}, title={${title}}, author={A}}` })
    expect(res.status).toBe(201)
    const found = await as('GET', `/library/items?q=${encodeURIComponent(title)}`)
    expect(found.body.data.length).toBeGreaterThan(0)
  })

  it('C-43: the server’s BibTeX reader keeps a title with braces inside it', async () => {
    const res = await as('POST', '/library/bibtex/preview', { bibtex: '@book{k, title={A {B} C}, author={x@y.org}}' })
    expect(res.body.data.entries[0].title).toBe('A B C')
  })

  it('C-43: there is a RIS preview', async () => {
    expect((await as('POST', '/library/ris/preview', { ris: 'TY  - BOOK\nTI  - T\nER  - ' })).status).toBe(200)
  })

  it('C-43: there is an upload endpoint that answers with a scan status', async () => {
    const res = await as('GET', '/library/uploads')
    expect(res.status).toBe(200)
  })

  it('cleans up: removes the library items made', async () => {
    for (const id of itemIds) expect((await as('DELETE', `/library/items/${id}`)).status).toBe(200)
  })
})
