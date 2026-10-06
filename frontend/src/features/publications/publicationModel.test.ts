import { describe, expect, it } from 'vitest'
import type { PublicPublication } from '@/api/schemas/publication'
import { authorsOf, citeAs, finishedReviewCount, isRegisteredDoi, noticeOf } from './publicationModel'

const pub = (over: Partial<PublicPublication> = {}): PublicPublication => ({ public_slug: 's', title: 'The Kufan routes', status: 'published', ...over })

describe('isRegisteredDoi', () => {
  it('accepts a real DOI and refuses the identifier the server makes up', () => {
    expect(isRegisteredDoi('10.1234/abc.5')).toBe(true)
    expect(isRegisteredDoi('10.5281/openhadith.7.1759999999')).toBe(false)
    expect(isRegisteredDoi('https://hadith.dev/pub/x')).toBe(false)
    expect(isRegisteredDoi(null)).toBe(false)
    expect(isRegisteredDoi('')).toBe(false)
  })
})

it('credits only the owner, by name', () => {
  expect(authorsOf(pub({ project: { owner: { display_name: 'Shilan Rashid' } } }))).toEqual(['Shilan Rashid'])
  expect(authorsOf(pub())).toEqual([])
})

it('counts finished reviews and nothing about who wrote them', () => {
  expect(finishedReviewCount(pub({ submission: { reviews: [{ submitted_at: '2026-10-01' }, { submitted_at: null }, {}] } }))).toBe(1)
  expect(finishedReviewCount(pub())).toBe(0)
})

describe('noticeOf', () => {
  it('retracted beats corrected, and a plain publication has none', () => {
    expect(noticeOf(pub({ status: 'retracted', corrigenda: [{ notice: 'x' }] }))).toBe('retracted')
    expect(noticeOf(pub({ corrigenda: [{ notice: 'x' }] }))).toBe('corrected')
    expect(noticeOf(pub({ corrigenda: [] }))).toBeNull()
  })
})

it('builds a plain citation line from what the page shows', () => {
  expect(citeAs(pub({ released_at: '2026-10-12T00:00:00Z', version_string: '1.0.0', project: { owner: { display_name: 'S. Rashid' } } }))).toBe('S. Rashid. (2026). The Kufan routes. v1.0.0')
  expect(citeAs(pub())).toBe('The Kufan routes')
})
