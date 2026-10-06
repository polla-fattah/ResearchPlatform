import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import { normalizeError } from '@/api/errors'
import {
  corpusBookSchema,
  corpusCriticismSchema,
  corpusHadithSchema,
  corpusNarratorSchema,
  corpusSearchHitSchema,
} from '@/api/schemas/corpus'

/**
 * Contract tests against a running backend (default http://127.0.0.1:8000).
 * Read-only, public endpoints only. They fail when the backend drifts from the schemas the
 * frontend relies on. Run: `php artisan serve` in backend/, then `npm run test:contract`.
 */
const BASE = process.env.CONTRACT_BASE_URL ?? 'http://127.0.0.1:8000'

async function get(path: string) {
  const res = await fetch(`${BASE}/api/v1${path}`, { headers: { Accept: 'application/json' } })
  return { status: res.status, body: (await res.json()) as Record<string, any> }
}

const reachable = await fetch(`${BASE}/up`).then(
  (r) => r.ok,
  () => false,
)

describe.skipIf(!reachable)(`backend contract (${BASE})`, () => {
  it('corpus search returns report records with occurrences', async () => {
    const { status, body } = await get('/corpus/search?q=%D8%A7%D9%84%D9%88%D8%B6%D9%88%D8%A1&per_page=2')
    expect(status).toBe(200)
    expect(body.meta.pagination).toMatchObject({ current_page: 1, per_page: 2 })
    const hadith = z.array(corpusSearchHitSchema).parse(body.data)
    expect(hadith.length).toBeGreaterThan(0)
    expect(hadith[0]?.occurrences?.length ?? 0).toBeGreaterThan(0)
  })

  it('hadith detail includes sanads under each reference', async () => {
    const search = await get('/corpus/search?q=%D8%A7%D9%84%D9%88%D8%B6%D9%88%D8%A1&per_page=1')
    const id = search.body.data[0].id as number
    const { body } = await get(`/corpus/hadiths/${id}`)
    const hadith = corpusHadithSchema.parse(body.data)
    expect(hadith.references?.some((r) => (r.sanads?.length ?? 0) > 0)).toBe(true)
  })

  it('books and narrators match the schemas', async () => {
    const books = await get('/corpus/books?per_page=3')
    z.array(corpusBookSchema).parse(books.body.data)

    const search = await get('/corpus/search?q=%D8%A7%D9%84%D9%88%D8%B6%D9%88%D8%A1&per_page=1')
    const hadith = await get(`/corpus/hadiths/${search.body.data[0].id}`)
    const narratorId = hadith.body.data.references
      .flatMap((r: any) => r.sanads ?? [])
      .flatMap((s: any) => s.narrator_nodes ?? [])
      .find((n: any) => n.narrator_id)?.narrator_id as number
    const narrator = await get(`/corpus/narrators/${narratorId}`)
    corpusNarratorSchema.parse(narrator.body.data)
    const criticism = await get(`/corpus/narrators/${narratorId}/criticism?per_page=2`)
    z.array(corpusCriticismSchema).parse(criticism.body.data)
  })

  it('corpus not-found is normalised to NOT_FOUND (also for the legacy HTTP 400 / code "404" form)', async () => {
    const { status, body } = await get('/corpus/hadiths/999999999')
    const err = normalizeError(status, body)
    expect(err.code).toBe('NOT_FOUND')
    expect(err.status).toBe(404)
  })

  it('validation errors use Laravel 422 field errors', async () => {
    const res = await fetch(`${BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: '{}',
    })
    const err = normalizeError(res.status, await res.json())
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(Object.keys(err.fields)).toEqual(expect.arrayContaining(['email', 'password']))
  })

  it('search hits carry highlights, why-matched and occurrence chain summaries', async () => {
    const q = encodeURIComponent('توضأ ثلاثا')
    const { body } = await get(`/corpus/search?q=${q}&mode=exact&per_page=2`)
    const hits = z.array(corpusSearchHitSchema).parse(body.data)
    expect(hits[0]?.why).toBe('exact_phrase')
    expect(hits[0]?.highlights?.length ?? 0).toBeGreaterThan(0)
    // Highlights must index into the original matn.
    const h = hits[0]!.highlights![0]!
    expect(hits[0]!.matn!.slice(h.start, h.start + h.length).length).toBe(h.length)
    expect(hits[0]?.occurrences?.[0]?.chain_summary?.narrator_count).toBeGreaterThan(0)
  })

  it('DEF-5: public endpoints do not expose email, is_admin or roles', async () => {
    for (const path of ['/public/announcements?per_page=5', '/public/research?per_page=5', '/public/researchers']) {
      const { body } = await get(path)
      const text = JSON.stringify(body.data)
      expect(text, path).not.toMatch(/"(email|is_admin|roles|password_reset_token|mfa_secret)"/)
    }
  })

  it('hukm and chapter lookups respond (were HTTP 500, request file C-5)', async () => {
    const hukms = await get('/corpus/hukms')
    expect(hukms.status).toBe(200)
    expect(hukms.body.data[0]).toHaveProperty('label')
    expect((await get('/corpus/books/1/chapters')).status).toBe(200)
  })

  it('occurrences carry a locator the design needs (page, hadith number, edition)', async () => {
    const q = encodeURIComponent('توضأ ثلاثا')
    const { body } = await get(`/corpus/search?q=${q}&mode=exact&per_page=1`)
    const occ = z.array(corpusSearchHitSchema).parse(body.data)[0]!.occurrences![0]!
    expect(occ.page_number ?? occ.hadith_number).toBeDefined()
    expect(body.meta.counts.total_occurrences).toEqual(expect.any(Number))
  })

  it('DEF-1: every API error uses the envelope with a stable code', async () => {
    const notFound = await get('/corpus/hadiths/999999999')
    expect(notFound.status).toBe(404)
    expect(notFound.body.error.code).toBe('NOT_FOUND')

    const unauthenticated = await get('/auth/me')
    expect(unauthenticated.status).toBe(401)
    expect(unauthenticated.body.error.code).toBe('UNAUTHENTICATED')
  })
})
