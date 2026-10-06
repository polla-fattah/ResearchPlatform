import { describe, expect, it } from 'vitest'
import {
  applicationCode,
  grantState,
  humanBytes,
  isOpen,
  LIMIT_GROUPS,
  objectCode,
  settableRoles,
  topRole,
  ungroupedLimits,
  windowStart,
} from './adminModel'

describe('roles', () => {
  it('offers only the roles an administrator can set, and ignores the applicant state the API also reports', () => {
    expect(settableRoles(['applicant', 'reviewer', 'researcher'])).toEqual(['researcher', 'reviewer'])
    expect(settableRoles([])).toEqual([])
  })
  it('names the highest role of an account', () => {
    expect(topRole(['researcher', 'editor', 'admin'])).toBe('admin')
    expect(topRole(['researcher', 'reviewer'])).toBe('reviewer')
    expect(topRole(['applicant'])).toBeNull()
  })
})

describe('applications', () => {
  it('uses the server’s reference, or builds the code from the id', () => {
    expect(applicationCode({ id: 4, reference: 'APP-2026-0417' })).toBe('APP-2026-0417')
    expect(applicationCode({ id: 4, reference: null })).toBe('APP-0004')
  })
  it('lets only waiting applications be decided', () => {
    expect(['pending', 'information_requested'].every(isOpen)).toBe(true)
    expect(['approved', 'rejected'].some(isOpen)).toBe(false)
  })
})

describe('grantState', () => {
  const now = Date.parse('2026-10-06T10:00:00Z')
  it('says active with the hours left, rounded up, until the expiry', () => {
    expect(grantState({ expires_at: '2026-10-07T08:00:00Z' }, now)).toEqual({ state: 'active', hoursLeft: 22 })
    expect(grantState({ expires_at: '2026-10-06T10:20:00Z' }, now)).toEqual({ state: 'active', hoursLeft: 1 })
  })
  it('says expired at the expiry, after it, and when there is no usable expiry', () => {
    expect(grantState({ expires_at: '2026-10-06T10:00:00Z' }, now).state).toBe('expired')
    expect(grantState({ expires_at: '2026-10-01T10:00:00Z' }, now).state).toBe('expired')
    expect(grantState({ expires_at: null }, now).state).toBe('expired')
  })
})

describe('objectCode', () => {
  it('writes the codes the design uses, and the type and number for anything else', () => {
    expect(objectCode('user', 7)).toBe('ACC-0007')
    expect(objectCode('project', 15)).toBe('PRJ-0015')
    expect(objectCode('researcher_application', 88)).toBe('APP-0088')
    expect(objectCode('thing', 3)).toBe('thing #3')
    expect(objectCode('thing', null)).toBe('thing')
    expect(objectCode(null, 3)).toBe('—')
  })
})

describe('windowStart', () => {
  it('goes back the window from now', () => {
    const now = Date.parse('2026-10-06T12:00:00Z')
    expect(windowStart('day', now)).toBe('2026-10-05T12:00:00.000Z')
    expect(windowStart('week', now)).toBe('2026-09-29T12:00:00.000Z')
  })
})

describe('humanBytes', () => {
  it('keeps bytes whole and rounds larger units to one decimal', () => {
    expect(humanBytes(900)).toEqual({ value: 900, unit: 'B' })
    expect(humanBytes(9596)).toEqual({ value: 9.4, unit: 'KB' })
    expect(humanBytes(5 * 1024 ** 3)).toEqual({ value: 5, unit: 'GB' })
  })
})

describe('limits', () => {
  it('lists the limits the server reports that the groups do not name, so none is hidden', () => {
    expect(ungroupedLimits({ concurrent_export_jobs: 2, brand_new_limit: 9 })).toEqual(['brand_new_limit'])
    expect(LIMIT_GROUPS.flatMap((g) => g.keys)).toContain('result_set_max_size')
  })
})
