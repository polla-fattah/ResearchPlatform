import { describe, expect, it } from 'vitest'
import { clearAllLocalDrafts, clearLocalDraft, readLocalDraft, writeLocalDraft } from './localDraft'

describe('local drafts', () => {
  it('keeps, reads and clears one draft', () => {
    writeLocalDraft(1, 2, { text: 'abc', baseVersion: 3, at: 10 })
    expect(readLocalDraft(1, 2)).toEqual({ text: 'abc', baseVersion: 3, at: 10 })
    clearLocalDraft(1, 2)
    expect(readLocalDraft(1, 2)).toBeNull()
  })

  it('clears every draft and nothing else, for sign-out', () => {
    writeLocalDraft(1, 2, { text: 'a', baseVersion: 1, at: 1 })
    writeLocalDraft(3, 4, { text: 'b', baseVersion: 1, at: 1 })
    localStorage.setItem('oh.prefs', '{"theme":"dark"}')
    localStorage.setItem('oh.lang', 'ar')
    clearAllLocalDrafts()
    expect(readLocalDraft(1, 2)).toBeNull()
    expect(readLocalDraft(3, 4)).toBeNull()
    expect(localStorage.getItem('oh.prefs')).toBe('{"theme":"dark"}')
    expect(localStorage.getItem('oh.lang')).toBe('ar')
  })

  it('ignores a damaged draft', () => {
    localStorage.setItem('oh.draft.1.2', '{not json')
    expect(readLocalDraft(1, 2)).toBeNull()
  })
})
