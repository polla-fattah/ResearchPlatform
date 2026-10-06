import { describe, expect, it } from 'vitest'
import { formatCode, parseCode } from './codes'
import { can, normalizeRole } from './roles'

describe('roles', () => {
  it('maps both backend vocabularies onto the SRS set, never upward', () => {
    expect(normalizeRole('owner')).toBe('owner')
    expect(normalizeRole('co_investigator')).toBe('researcher')
    expect(normalizeRole('contributor')).toBe('researcher')
    expect(normalizeRole('observer')).toBe('viewer')
    expect(normalizeRole('reviewer')).toBe('reviewer')
    expect(normalizeRole('admin')).toBeNull()
    expect(normalizeRole(undefined)).toBeNull()
  })

  it('follows the SRS §3.2 permission matrix', () => {
    expect(can('owner', 'manageMembers')).toBe(true)
    expect(can('researcher', 'manageMembers')).toBe(false)
    expect(can('researcher', 'editShared')).toBe(true)
    expect(can('reviewer', 'editShared')).toBe(false)
    expect(can('reviewer', 'comment')).toBe(true)
    expect(can('viewer', 'comment')).toBe(false)
    expect(can('viewer', 'createPrivateAnnotation')).toBe(true)
    expect(can('researcher', 'publishAnnouncement')).toBe(false)
    expect(can('researcher', 'submitFormal')).toBe(false)
    expect(can('researcher', 'archiveOrTrash')).toBe(false)
    expect(can(null, 'read')).toBe(false)
  })
})

describe('display codes', () => {
  it('formats and parses codes', () => {
    expect(formatCode('PRJ', 12)).toBe('PRJ-0012')
    expect(formatCode('EV', 4)).toBe('EV-0004')
    expect(formatCode('F', 2)).toBe('F-02')
    expect(formatCode('OCC', 106)).toBe('OCC-000106')
    expect(parseCode('EV-0004')).toEqual({ prefix: 'EV', id: 4 })
    expect(parseCode('nope')).toBeNull()
    expect(parseCode('ZZZ-1')).toBeNull()
  })

  it('does not truncate ids wider than the padding', () => {
    expect(formatCode('EV', 123456)).toBe('EV-123456')
  })
})
