import { describe, expect, it } from 'vitest'
import { isHidden, isValidSlug, keywordsText, parseKeywords, publishGaps, slugify, statusToKeep } from './announcementModel'

describe('slugify', () => {
  it('makes an address part from a title, keeping letters of any script', () => {
    expect(slugify('Chains of the wuḍūʾ reports, 2nd c.!')).toBe('chains-of-the-wuḍūʾ-reports-2nd-c')
    expect(slugify('  --Niyyah  isnad--  ')).toBe('niyyah-isnad')
    expect(slugify('أسانيد الوضوء')).toBe('أسانيد-الوضوء')
    expect(slugify('x'.repeat(200))).toHaveLength(80)
  })
})

describe('isValidSlug', () => {
  it('accepts words joined by single hyphens and nothing else', () => {
    expect(isValidSlug('niyyah-isnad-2')).toBe(true)
    expect(isValidSlug('')).toBe(false)
    expect(isValidSlug('a--b')).toBe(false)
    expect(isValidSlug('a b')).toBe(false)
    expect(isValidSlug('-a')).toBe(false)
    expect(isValidSlug('a/b')).toBe(false)
  })
})

describe('keywords', () => {
  it('splits on commas, Arabic commas, semicolons and lines, trims and drops repeats', () => {
    expect(parseKeywords('isnad, Niyyah،wuḍūʾ;\n  isnad ,, ')).toEqual(['isnad', 'Niyyah', 'wuḍūʾ'])
    expect(parseKeywords('')).toEqual([])
    expect(keywordsText(['a', 'b'])).toBe('a, b')
    expect(keywordsText(null)).toBe('')
  })
})

describe('publishGaps', () => {
  it('lists what the server needs and unsaved changes', () => {
    expect(publishGaps({ title: '', summary: ' ', slug: 'a b' }, true)).toEqual(['title', 'summary', 'slug', 'unsaved'])
    expect(publishGaps({ title: 'T', summary: 'S', slug: 'a-b' }, false)).toEqual([])
  })
})

it('knows a moderator-hidden announcement', () => {
  expect(isHidden({ status: 'hidden' })).toBe(true)
  expect(isHidden({ status: 'draft' })).toBe(false)
  expect(isHidden(null)).toBe(false)
})

describe('statusToKeep', () => {
  it('keeps a published page published so saving never takes it down, and never publishes anything else', () => {
    expect(statusToKeep({ status: 'published' })).toBe('published')
    expect(statusToKeep({ status: 'unpublished' })).toBe('unpublished')
    expect(statusToKeep(null)).toBe('draft')
  })
})
