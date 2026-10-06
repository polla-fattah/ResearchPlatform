import { describe, expect, it } from 'vitest'
import type { Invitation, Member } from '@/api/schemas/members'
import { invitationLink, invitationState, memberRows, openInvitations, roleMatrix } from './membersModel'

const member = (over: Partial<Member> = {}): Member => ({ id: 1, user_id: 2, role: 'researcher', status: 'accepted', joined_at: '2026-09-01T00:00:00Z', user: { id: 2, display_name: 'Aras' }, ...over })

describe('memberRows', () => {
  it('puts the owner first, then people by the day they joined', () => {
    const rows = memberRows(
      [member({ user_id: 5, joined_at: '2026-09-10T00:00:00Z' }), member({ user_id: 3, joined_at: '2026-09-02T00:00:00Z' }), member({ user_id: 1, role: 'owner' })],
      { id: 1, name: 'Shilan' },
    )
    expect(rows.map((r) => r.userId)).toEqual([1, 3, 5])
    expect(rows[0]).toMatchObject({ isOwner: true, role: 'owner' })
  })

  it('adds the project’s owner when the server’s list leaves them out', () => {
    const rows = memberRows([member()], { id: 1, name: 'Shilan' })
    expect(rows[0]).toMatchObject({ userId: 1, name: 'Shilan', role: 'owner', contributions: null })
    expect(rows).toHaveLength(2)
  })

  it('never shows an unknown role as more than a viewer', () => {
    expect(memberRows([member({ role: 'wizard' })], null)[0]?.role).toBe('viewer')
  })

  it('only the project’s owner is the owner; a stored "owner" role on someone else is shown as stored but not as the owner (C-22)', () => {
    const rows = memberRows([member({ user_id: 9, role: 'owner' })], { id: 1, name: 'x' })
    expect(rows.find((r) => r.userId === 9)).toMatchObject({ isOwner: false, role: 'owner' })
    expect(rows[0]?.userId).toBe(1)
  })

  it('reads the member’s own counts and never the project-wide findings count', () => {
    const row = memberRows([member({ contribution_summary: { evidence_items: 4, documents: 1, comments: 9, tasks: 2, findings: 99 } })], null)[0]
    expect(row?.contributions).toEqual({ evidence: 4, documents: 1, comments: 9, tasks: 2 })
  })
})

describe('invitationState', () => {
  const now = Date.parse('2026-10-10T00:00:00Z')
  it('turns a pending invitation past its day into expired', () => {
    expect(invitationState({ status: 'pending', expires_at: '2026-10-09T00:00:00Z' }, now)).toBe('expired')
    expect(invitationState({ status: 'pending', expires_at: '2026-10-11T00:00:00Z' }, now)).toBe('waiting')
    expect(invitationState({ status: 'declined', expires_at: null }, now)).toBe('declined')
    expect(invitationState({ status: 'pending', expires_at: null }, now)).toBe('waiting')
    expect(invitationState({ status: 'strange', expires_at: null }, now)).toBe('other')
  })
  it('does not repeat accepted invitations', () => {
    const inv = (status: string): Invitation => ({ id: 1, email: 'a@b.c', role: 'viewer', status })
    expect(openInvitations([inv('accepted'), inv('pending')])).toHaveLength(1)
  })
})

it('builds the link from the origin and the token', () => {
  expect(invitationLink('https://x.org', 'a b')).toBe('https://x.org/invitations/a%20b')
})

describe('roleMatrix', () => {
  it('is the permission table: only the owner manages members, a viewer cannot comment', () => {
    const row = (a: string) => roleMatrix().find((r) => r.action === a)?.allowed
    expect(row('manageMembers')).toEqual([true, false, false, false])
    expect(row('comment')).toEqual([true, true, true, false])
  })
})
