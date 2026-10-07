import { describe, expect, it } from 'vitest'
import { concordanceSchema, structureSchema } from '@/api/schemas/bookStructure'

/**
 * Contract test for book structure and word forms (screen 31). Read only, public endpoints (no account needed), so it
 * changes nothing. Known backend defects are `it.fails` (request file C-38). WRITTEN FROM THE BACKEND CODE AND NOT YET
 * RUN against a live server (the cloud session has no PHP 8.4). It needs a corpus with at least one book:
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
  let body: Record<string, any> = {}
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    body = { raw: text.slice(0, 200) }
  }
  return { status: res.status, body }
}

describe.skipIf(!reachable)(`book structure and word forms (${BASE})`, () => {
  let bookId = 0

  it('lists books and finds one to read', async () => {
    const res = await get('/corpus/books?per_page=1')
    expect(res.status).toBe(200)
    bookId = res.body.data[0]?.id
    expect(bookId).toBeGreaterThan(0)
  })

  it('answers the structure of a book: chapters with an occurrence count each', async () => {
    const res = await get(`/corpus/books/${bookId}/structure`)
    expect(res.status).toBe(200)
    const s = structureSchema.parse(res.body.data)
    expect(s.book_id).toBe(bookId)
    expect(s.total_chapters).toBe(s.chapters.length)
    expect(s.total_occurrences).toBe(s.chapters.reduce((a, c) => a + c.occurrence_count, 0))
  })

  it('answers a concordance whose total is the number of rows returned and never more than the limit', async () => {
    const res = await get('/corpus/concordance?q=%D9%85%D9%86&limit=5')
    expect(res.status).toBe(200)
    const c = concordanceSchema.parse(res.body.data)
    expect(c.total_matches).toBe(c.concordance_samples.length)
    expect(c.total_matches).toBeLessThanOrEqual(5)
  })

  it('refuses a one-character term', async () => {
    expect((await get('/corpus/concordance?q=%D9%85')).status).toBe(422)
  })

  it('lists the reports of one chapter through the search, with only the book and chapter as filters', async () => {
    const s = structureSchema.parse((await get(`/corpus/books/${bookId}/structure`)).body.data)
    const chapter = s.chapters.find((c) => c.occurrence_count > 0)
    if (!chapter) return
    const res = await get(`/corpus/search?book_id=${bookId}&chapter_id=${chapter.chapter_id}&per_page=3`)
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThan(0)
  })

  it('C-38: a book that is not in the corpus answers 404, not 200 with a made-up title', async () => {
    expect((await get('/corpus/books/999999999/structure')).status).toBe(404)
  })

  it('C-38: a % in the term is searched as the character, not as a wildcard that matches everything', async () => {
    const c = concordanceSchema.parse((await get('/corpus/concordance?q=%25%25&limit=5')).body.data)
    expect(c.total_matches).toBe(0)
  })

  it('C-38: the concordance says how many places there are in all, beside the sample it returns', async () => {
    const body = (await get('/corpus/concordance?q=%D9%85%D9%86&limit=5')).body.data
    expect(body).toHaveProperty('total_available')
  })

  it('C-38: a snippet is cut around the match even when the text has vowel marks', async () => {
    const c = concordanceSchema.parse((await get('/corpus/concordance?q=%D8%AB%D9%84%D8%A7%D8%AB%D8%A7&limit=20')).body.data)
    expect(c.concordance_samples.every((s) => !s.snippet.endsWith('...') || s.snippet.includes('ثلاث'))).toBe(true)
  })

  it('C-38: the structure carries the printed chapter number, apart from the internal id', async () => {
    const raw = (await get(`/corpus/books/${bookId}/structure`)).body.data
    structureSchema.parse(raw)
    expect(raw.chapters[0]).toHaveProperty('chapter_number')
    expect(typeof raw.chapters[0].chapter_title).toBe('string')
  })
})
