import { describe, expect, it } from 'vitest'
import { groupSecret, interestsText, isTimeZone, parseInterests, publicFieldsOf, timeZoneChoices } from './settingsModel'

describe('interests', () => {
  it('splits on commas (Latin and Arabic) and lines, trims, and keeps each once', () => {
    expect(parseInterests('Takhrīj,  narrator criticism ،Takhrīj\n\nMatn')).toEqual(['Takhrīj', 'narrator criticism', 'Matn'])
    expect(parseInterests('  ')).toEqual([])
  })
  it('joins a list back into the text it was typed as', () => {
    expect(interestsText(['A', 'B'])).toBe('A, B')
    expect(interestsText(null)).toBe('')
  })
})

describe('publicFieldsOf', () => {
  it('reads a list of names', () => {
    expect(publicFieldsOf(['affiliation', 'email', 'nonsense'])).toEqual(['affiliation', 'email'])
  })
  it('reads a map of booleans, the demo data’s shape, counting only the true ones', () => {
    expect(publicFieldsOf({ biography: true, affiliation: false, research_interests: true })).toEqual(['research_interests', 'biography'])
  })
  it('means every field but the email when nothing is stored, as the public page does', () => {
    expect(publicFieldsOf(null)).toEqual(['research_interests', 'affiliation', 'biography'])
  })
})

describe('groupSecret', () => {
  it('writes a secret in groups of four', () => {
    expect(groupSecret('ABCDEFGHIJKLMNOP')).toBe('ABCD EFGH IJKL MNOP')
    expect(groupSecret('ABCDEF')).toBe('ABCD EF')
  })
})

describe('time zones', () => {
  it('knows a real zone from a made-up one', () => {
    expect(isTimeZone('Asia/Baghdad')).toBe(true)
    expect(isTimeZone('Mars/Olympus')).toBe(false)
  })
  it('always offers the zone in use and the browser’s, once each, and drops names the browser does not know', () => {
    const list = timeZoneChoices('Asia/Baghdad', 'Europe/Paris')
    expect(list[0]).toBe('Asia/Baghdad')
    expect(list).toContain('Europe/Paris')
    expect(list.filter((z) => z === 'Asia/Baghdad')).toHaveLength(1)
    expect(timeZoneChoices('Mars/Olympus', 'UTC')).not.toContain('Mars/Olympus')
  })
})
