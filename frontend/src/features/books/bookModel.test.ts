import { describe, expect, it } from 'vitest'
import { chapterLabel, distributionRows, excerpt, filterChapters, maybeMore, snippetShowsTerm, validTerm } from './bookModel'

const ch = (id: number, title: string | null, n = 1) => ({ chapter_id: id, chapter_title: title, occurrence_count: n })

describe('book model', () => {
  it('filters chapters ignoring vowel marks and letter variants, keeping order', () => {
    const list = [ch(1, 'بَابُ الْوُضُوءِ'), ch(2, 'باب الصلاة'), ch(3, null)]
    expect(filterChapters(list, 'الوضوء').map((c) => c.chapter_id)).toEqual([1])
    expect(filterChapters(list, 'باب').map((c) => c.chapter_id)).toEqual([1, 2])
    expect(filterChapters(list, '  ')).toHaveLength(3)
  })
  it('labels an untitled chapter by position', () => {
    expect(chapterLabel(ch(9, '  '), 4)).toBe('#4')
    expect(chapterLabel(ch(9, 'Title'), 4)).toBe('Title')
  })
  it('knows when a result may be cut off by the limit', () => {
    expect(maybeMore(50, 50)).toBe(true)
    expect(maybeMore(31, 50)).toBe(false)
  })
  it('sorts the distribution by count', () => {
    expect(distributionRows({ A: 1, B: 5, C: 3 }).map((r) => r.book)).toEqual(['B', 'C', 'A'])
  })
  it('tells a real context from the server’s fallback', () => {
    expect(snippetShowsTerm('...تَوَضَّأَ ثَلاثًا ثَلاثًا ثم...', 'ثلاثا')).toBe(true)
    expect(snippetShowsTerm('first hundred characters of something else...', 'ثلاثا')).toBe(false)
  })
  it('checks the term length the server accepts', () => {
    expect(validTerm('a')).toBe(false)
    expect(validTerm(' ab ')).toBe(true)
    expect(validTerm('x'.repeat(101))).toBe(false)
  })
  it('shortens long text', () => {
    expect(excerpt('a'.repeat(300), 10)).toBe('aaaaaaaaaa…')
    expect(excerpt(null)).toBe('')
  })
})
