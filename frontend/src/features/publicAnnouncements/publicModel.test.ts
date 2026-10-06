import { describe, expect, it } from 'vitest'
import { creditedNames, excerpt } from './publicModel'

describe('excerpt', () => {
  it('keeps a short text whole and cuts a long one at a word', () => {
    expect(excerpt('  A short   text. ')).toEqual({ text: 'A short text.', cut: false })
    const cut = excerpt('word '.repeat(100), 50)
    expect(cut.cut).toBe(true)
    expect(cut.text.endsWith('…')).toBe(true)
    expect(cut.text.slice(0, -1).endsWith('word')).toBe(true)
  })
})

it('credits only a name that exists', () => {
  expect(creditedNames({ display_name: 'Shilan' })).toEqual(['Shilan'])
  expect(creditedNames({ display_name: null })).toEqual([])
  expect(creditedNames(null)).toEqual([])
})
