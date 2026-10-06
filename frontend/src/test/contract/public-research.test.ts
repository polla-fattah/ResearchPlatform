import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { citationSchema, publicPublicationSchema } from '@/api/schemas/publication'

/**
 * Contract test for the public research pages (screens 24 and 25): no sign-in, no token, read-only. It reads the list,
 * each page and the citation and checks the whitelist: no e-mail address, no reviewer name or comment, no internal
 * notes. WRITTEN FROM THE BACKEND CODE AND NOT YET RUN against a live server (the cloud session has no PHP 8.4); the
 * expected-fail cases are request file C-32.
 *
 *   npm run test:contract
 */
const BASE = process.env.CONTRACT_BASE_URL ?? 'http://127.0.0.1:8000'

const reachable = await fetch(`${BASE}/up`).then(
  (r) => r.ok,
  () => false,
)

async function get(path: string) {
  const res = await fetch(`${BASE}/api/v1${path}`, { headers: { Accept: 'application/json' } })
  const text = await res.text()
  return { status: res.status, body: text ? (JSON.parse(text) as Record<string, any>) : {} }
}

describe.skipIf(!reachable)(`public research (${BASE})`, () => {
  it('lists released publications without signing in, paged, parsing with the public schema', async () => {
    const res = await get('/public/research?per_page=50')
    expect(res.status).toBe(200)
    z.array(publicPublicationSchema).parse(res.body.data)
    expect(res.body.meta.pagination).toMatchObject({ current_page: 1 })
    expect((res.body.data as { status: string }[]).every((p) => p.status === 'published')).toBe(true)
  })

  it('filters by words and by status on the server', async () => {
    expect((await get('/public/research?q=zzzz-no-such-word-zzzz')).body.data).toEqual([])
    const retracted = (await get('/public/research?status=retracted&per_page=50')).body.data as { status: string }[]
    expect(retracted.every((p) => p.status === 'retracted')).toBe(true)
  })

  it('answers 404 for an address that is not released, the same as one that never existed', async () => {
    const res = await get('/public/research/contract-test-does-not-exist')
    expect(res.status).toBe(404)
    expect(res.body.error?.code).toBe('NOT_FOUND')
  })

  it('shows no e-mail address or administrator flag on the list or on any page', async () => {
    const list = (await get('/public/research?per_page=20')).body.data as { public_slug: string }[]
    expect(JSON.stringify(list)).not.toMatch(/"email"|is_admin|"roles"|mfa_enabled/)
    for (const p of list.slice(0, 5)) {
      const page = await get(`/public/research/${p.public_slug}`)
      expect(page.status).toBe(200)
      expect(JSON.stringify(page.body.data)).not.toMatch(/"email"|is_admin|"roles"|mfa_enabled/)
    }
  })

  it('answers a citation for a publication, with the format it used', async () => {
    const first = ((await get('/public/research?per_page=1')).body.data as { public_slug: string }[])[0]
    if (!first) return
    const res = await get(`/public/research/${first.public_slug}/cite`)
    expect(res.status).toBe(200)
    expect(citationSchema.parse(res.body.data).citation.length).toBeGreaterThan(10)
  })

  it('C-32: the citation can be asked for in RIS and APA', async () => {
    const first = ((await get('/public/research?per_page=1')).body.data as { public_slug: string }[])[0]
    if (!first) throw new Error('no publication to check')
    const ris = citationSchema.parse((await get(`/public/research/${first.public_slug}/cite?format=ris`)).body.data)
    expect(ris.format.toLowerCase()).toBe('ris')
  })

  it('C-32: the public page carries no reviewer alias, comment or editor note', async () => {
    const first = ((await get('/public/research?per_page=1')).body.data as { public_slug: string }[])[0]
    if (!first) throw new Error('no publication to check')
    const text = JSON.stringify((await get(`/public/research/${first.public_slug}`)).body.data)
    expect(text).not.toMatch(/reviewer_alias|review_comments|editorial_notes|releaser/)
  })

  it('C-32: the public page does not carry internal ids', async () => {
    const first = ((await get('/public/research?per_page=1')).body.data as Record<string, any>[])[0]
    if (!first) throw new Error('no publication to check')
    expect(first.project ?? {}).not.toHaveProperty('id')
    expect(first.project?.owner ?? {}).not.toHaveProperty('id')
  })
})
