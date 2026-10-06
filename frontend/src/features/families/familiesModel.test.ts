import { describe, expect, it } from 'vitest'
import type { FamilyMember } from '@/api/schemas/families'
import { alreadyInFamily, countByRelationship, memberSource, parseDepth, sourceCode, splitMembers } from './familiesModel'

const m = (id: number, relationship_type: string, over: Partial<FamilyMember> = {}): FamilyMember => ({ id, relationship_type, ...over })

describe('members', () => {
  const members = [m(1, 'shahid'), m(2, 'candidate'), m(3, 'mutabaah_tammah'), m(4, 'candidate'), m(5, 'something_new')]
  it('splits the classified from the waiting, and keeps a type it does not know with the classified', () => {
    const { reviewed, candidates } = splitMembers(members)
    expect(candidates.map((x) => x.id)).toEqual([2, 4])
    expect(reviewed.map((x) => x.id)).toEqual([1, 3, 5])
  })
  it('counts each relationship it knows', () => {
    expect(countByRelationship(members)).toEqual({ mutabaah_tammah: 1, mutabaah_qasirah: 0, shahid: 1, candidate: 2 })
  })
})

describe('memberSource', () => {
  it('says what a member is, and names it with its code', () => {
    expect(memberSource({ evidence_id: 4, corpus_hadith_id: null })).toEqual({ kind: 'evidence', id: 4 })
    expect(memberSource({ evidence_id: null, corpus_hadith_id: 101 })).toEqual({ kind: 'report', id: 101 })
    expect(memberSource({})).toEqual({ kind: 'none' })
    expect(sourceCode({ kind: 'evidence', id: 4 })).toBe('EV-0004')
    expect(sourceCode({ kind: 'report', id: 101 })).toBe('REP-000101')
    expect(sourceCode({ kind: 'none' })).toBe('')
  })
})

it('knows a source is already in the family', () => {
  const family = { members: [m(1, 'shahid', { evidence_id: 4 }), m(2, 'shahid', { corpus_hadith_id: 101 })] }
  expect(alreadyInFamily(family, { evidence_id: 4 })).toBe(true)
  expect(alreadyInFamily(family, { corpus_hadith_id: 101 })).toBe(true)
  expect(alreadyInFamily(family, { evidence_id: 5 })).toBe(false)
  expect(alreadyInFamily(family, {})).toBe(false)
})

it('parses a depth: empty is not given, a whole number from 1 is kept, anything else is refused', () => {
  expect(parseDepth('')).toEqual({ ok: true })
  expect(parseDepth(' 3 ')).toEqual({ ok: true, value: 3 })
  expect(parseDepth('0').ok).toBe(false)
  expect(parseDepth('2.5').ok).toBe(false)
  expect(parseDepth('x').ok).toBe(false)
})
