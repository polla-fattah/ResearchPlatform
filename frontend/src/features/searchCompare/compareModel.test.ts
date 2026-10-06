import { describe, expect, it } from 'vitest'
import { comparableRuns, corpusChange, queryEdited, inOrder, pageOf, splitSubscriptions, totalPages } from './compareModel'

const run = (id: number, over: Record<string, unknown> = {}) => ({ id, saved_query_id: 5, status: 'completed', created_at: `2026-09-0${id}T00:00:00Z`, corpus_version: 'v1', ...over })
const sub = (id: number, user: number, active: boolean, query = 5) => ({ id, user_id: user, saved_query_id: query, frequency: 'weekly', is_active: active })

describe('search compare model', () => {
  it('keeps only completed runs of the query, oldest first', () => {
    const list = comparableRuns([run(3), run(1), run(2, { status: 'failed' }), run(4, { saved_query_id: 9 })], 5)
    expect(list.map((r) => r.id)).toEqual([1, 3])
  })
  it('puts the older run first whichever way they were chosen', () => {
    expect(inOrder(run(3), run(1)).map((r) => r.id)).toEqual([1, 3])
    expect(inOrder(run(1), run(3)).map((r) => r.id)).toEqual([1, 3])
    expect(inOrder(run(2, { created_at: null }), run(1, { created_at: null })).map((r) => r.id)).toEqual([1, 2])
  })
  it('tells whether the corpus changed, and says unknown when a run did not record it', () => {
    expect(corpusChange(run(1), run(2))).toBe('same')
    expect(corpusChange(run(1), run(2, { corpus_version: 'v2' }))).toBe('changed')
    expect(corpusChange(run(1), run(2, { corpus_version: null }))).toBe('unknown')
  })
  it('tells whether the query was edited between the runs', () => {
    expect(queryEdited({ query_version: 1 }, { query_version: 1 })).toBe('same')
    expect(queryEdited({ query_version: 1 }, { query_version: 2 })).toBe('edited')
    expect(queryEdited({ query_version: null }, { query_version: 2 })).toBe('unknown')
  })
  it('pages ids ten at a time', () => {
    const ids = Array.from({ length: 23 }, (_, i) => i)
    expect(pageOf(ids, 1)).toHaveLength(10)
    expect(pageOf(ids, 3)).toEqual([20, 21, 22])
    expect(pageOf(ids, 0)).toHaveLength(10)
    expect(totalPages(23)).toBe(3)
    expect(totalPages(0)).toBe(1)
  })
  it('splits my subscription from the active ones of others', () => {
    const { mine, others } = splitSubscriptions([sub(1, 1, false), sub(2, 2, true), sub(3, 3, false), sub(4, 2, true, 9)], 5, 1)
    expect(mine?.id).toBe(1)
    expect(others.map((s) => s.id)).toEqual([2])
    expect(splitSubscriptions([], 5, 1).mine).toBeNull()
  })
})
