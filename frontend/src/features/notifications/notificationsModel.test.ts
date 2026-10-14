import { describe, expect, it } from 'vitest'
import { needsTaskLookup, notificationHref, unreadOn } from './notificationsModel'

const task = (id: number) => (taskId: number) => (taskId === id ? 12 : null)

describe('notificationHref', () => {
  it('leads an acceptance to the members and a role change to the project', () => {
    expect(notificationHref({ type: 'invitation_accepted', target_type: 'project', target_id: 12 }, () => null)).toBe('/projects/12/members')
    expect(notificationHref({ type: 'role_updated', target_type: 'project', target_id: 12 }, () => null)).toBe('/projects/12/overview')
  })
  it('leads a pending invitation to the page that answers it, and an answered one nowhere', () => {
    expect(notificationHref({ type: 'invitation', target_type: 'project', target_id: 12, invitation_token: 'a b' }, () => null)).toBe('/invitations/a%20b')
    expect(notificationHref({ type: 'invitation', target_type: 'project', target_id: 12 }, () => null)).toBeNull()
    expect(notificationHref({ type: 'invitation', target_type: 'project', target_id: 12, invitation_token: null }, () => null)).toBeNull()
  })
  it('uses the project a task notification names, without the assigned-task lookup', () => {
    expect(notificationHref({ type: 'assignment', target_type: 'task', target_id: 5, project_id: 14 }, () => null)).toBe('/projects/14/discussion?view=tasks&mine=1')
  })
  it('finds the project of a task from the assigned tasks, or gives no link', () => {
    expect(notificationHref({ type: 'assignment', target_type: 'task', target_id: 5 }, task(5))).toBe('/projects/12/discussion?view=tasks&mine=1')
    expect(notificationHref({ type: 'assignment', target_type: 'task', target_id: 6 }, task(5))).toBeNull()
  })
  it('gives no link for a target it does not know', () => {
    expect(notificationHref({ type: 'x', target_type: 'wizard', target_id: 1 }, () => null)).toBeNull()
  })
})

it('knows when the task lookup is needed and how many are unread', () => {
  const items = [
    { id: 1, type: 'assignment', target_type: 'task', target_id: 5, is_read: false },
    { id: 2, type: 'role_updated', target_type: 'project', target_id: 1, is_read: true },
  ]
  expect(needsTaskLookup(items)).toBe(true)
  expect(needsTaskLookup(items.slice(1))).toBe(false)
  expect(unreadOn(items)).toBe(1)
})
