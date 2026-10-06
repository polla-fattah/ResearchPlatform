import { describe, expect, it } from 'vitest'
import type { Comment, Thread } from '@/api/schemas/discussion'
import { dueForServer, dueState, openedBy, targetHref, threadCounts, visibleThreads } from './discussionModel'

const thread = (id: number, is_resolved: boolean): Thread => ({ id, title: `t${id}`, is_resolved })

describe('threads', () => {
  const items = [thread(1, false), thread(2, true), thread(3, false)]
  it('counts and filters by state', () => {
    expect(threadCounts(items)).toEqual({ open: 2, resolved: 1, all: 3 })
    expect(visibleThreads(items, 'open').map((t) => t.id)).toEqual([1, 3])
    expect(visibleThreads(items, 'resolved').map((t) => t.id)).toEqual([2])
    expect(visibleThreads(items, 'all')).toHaveLength(3)
  })
})

describe('targetHref', () => {
  it('points to the page that shows the object, and to nothing for a passage', () => {
    expect(targetHref(12, 'evidence', 4)).toBe('/projects/12/evidence?item=4')
    expect(targetHref(12, 'finding', 2)).toBe('/projects/12/findings?finding=2')
    expect(targetHref(12, 'document', 7)).toBe('/projects/12/findings?doc=7')
    expect(targetHref(12, 'project', 12)).toBe('/projects/12/overview')
    expect(targetHref(12, 'passage', 3)).toBeNull()
    expect(targetHref(12, 'evidence', null)).toBeNull()
  })
})

describe('openedBy', () => {
  it('is the author of the first reply, or nobody', () => {
    const c = (name: string): Comment => ({ id: 1, content: 'x', author: { display_name: name } })
    expect(openedBy([c('Shilan'), c('Aras')])).toBe('Shilan')
    expect(openedBy([])).toBeNull()
    expect(openedBy(undefined)).toBeNull()
  })
})

describe('dueState', () => {
  const now = new Date(2026, 9, 10, 15, 0, 0).getTime()
  it('compares days in the person’s own day', () => {
    expect(dueState({ due_date: '2026-10-09T00:00:00.000000Z', status: 'open' }, now)).toBe('overdue')
    expect(dueState({ due_date: '2026-10-10', status: 'open' }, now)).toBe('today')
    expect(dueState({ due_date: '2026-10-11', status: 'in_progress' }, now)).toBe('later')
    expect(dueState({ due_date: null, status: 'open' }, now)).toBeNull()
  })
  it('never calls a finished task overdue', () => {
    expect(dueState({ due_date: '2020-01-01', status: 'done' }, now)).toBeNull()
  })
})

it('turns an empty date field into no date', () => {
  expect(dueForServer('')).toBeNull()
  expect(dueForServer(' 2026-10-20 ')).toBe('2026-10-20')
})
