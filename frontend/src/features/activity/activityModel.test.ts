import { describe, expect, it } from 'vitest'
import type { Activity } from '@/api/schemas/activity'
import { activityHref, groupByDay, rangeStart, visibleSummary } from './activityModel'

const a = (id: number, created_at: string | null, over: Partial<Activity> = {}): Activity => ({ id, action: 'task_created', created_at, ...over })

describe('rangeStart', () => {
  const now = Date.parse('2026-10-10T15:30:00Z')
  it('is a plain day, and the same through the whole day', () => {
    expect(rangeStart('7', now)).toBe('2026-10-03')
    expect(rangeStart('30', now)).toBe('2026-09-10')
    expect(rangeStart('7', now + 3 * 3600_000)).toBe('2026-10-03')
    expect(rangeStart('all', now)).toBeUndefined()
  })
})

describe('activityHref', () => {
  it('leads to the screen that shows the object', () => {
    expect(activityHref(12, { object_type: 'evidence', object_id: 4 })).toBe('/projects/12/evidence?item=4')
    expect(activityHref(12, { object_type: 'discussion_thread', object_id: 14 })).toBe('/projects/12/discussion?thread=14&state=all')
    expect(activityHref(12, { object_type: 'task', object_id: 5 })).toBe('/projects/12/discussion?view=tasks')
    expect(activityHref(12, { object_type: 'membership', object_id: 5 })).toBe('/projects/12/members')
    expect(activityHref(12, { object_type: 'announcement', object_id: 1 })).toBeNull()
    expect(activityHref(12, { object_type: null, object_id: null })).toBeNull()
  })
})

describe('visibleSummary', () => {
  it('hides an invitation’s sentence (it names the e-mail address) from everyone but the owner', () => {
    const inv = { action: 'invitation_created', summary: 'Invited dilan@example.org as Viewer' }
    expect(visibleSummary(inv, true)).toBe('Invited dilan@example.org as Viewer')
    expect(visibleSummary(inv, false)).toBeNull()
    expect(visibleSummary({ action: 'task_created', summary: "Created task: 'x'" }, false)).toBe("Created task: 'x'")
  })
})

describe('groupByDay', () => {
  it('keeps the order and starts a group when the day changes', () => {
    const groups = groupByDay([a(1, '2026-10-10T12:00:00'), a(2, '2026-10-10T08:00:00'), a(3, '2026-10-09T23:00:00'), a(4, null)])
    expect(groups.map((g) => [g.day, g.items.map((i) => i.id)])).toEqual([
      ['2026-10-10', [1, 2]],
      ['2026-10-09', [3]],
      ['', [4]],
    ])
  })
})
