import { describe, expect, it } from 'vitest'
import { assignmentState, canSubmitReview, citationCount, dueState } from './reviewModel'

describe('assignmentState and dueState', () => {
  const now = Date.parse('2026-10-10T00:00:00Z')
  it('is submitted when it has a completion time', () => {
    expect(assignmentState({ completed_at: '2026-10-01' })).toBe('submitted')
    expect(assignmentState({ completed_at: null })).toBe('to_review')
  })
  it('judges the due day at the moment of loading, and never for a finished review', () => {
    expect(dueState({ due_date: '2026-10-09T00:00:00Z', completed_at: null }, now)).toBe('overdue')
    expect(dueState({ due_date: '2026-10-12T00:00:00Z', completed_at: null }, now)).toBe('soon')
    expect(dueState({ due_date: '2026-10-20T00:00:00Z', completed_at: null }, now)).toBe('later')
    expect(dueState({ due_date: '2020-01-01T00:00:00Z', completed_at: 'x' }, now)).toBeNull()
    expect(dueState({ due_date: null, completed_at: null }, now)).toBeNull()
  })
})

describe('canSubmitReview', () => {
  const ok = { recommendation: 'approve', notes: 'Sound and clearly argued.', score: 8 }
  it('needs a recommendation, ten characters of notes and a score in range when given', () => {
    expect(canSubmitReview(ok)).toBe(true)
    expect(canSubmitReview({ ...ok, score: null })).toBe(true)
    expect(canSubmitReview({ ...ok, recommendation: null })).toBe(false)
    expect(canSubmitReview({ ...ok, notes: 'short' })).toBe(false)
    expect(canSubmitReview({ ...ok, score: 11 })).toBe(false)
    expect(canSubmitReview({ ...ok, score: 0 })).toBe(false)
  })
})

it('counts citations over every document', () => {
  expect(citationCount({ documents: [{ latest_version: { citations: [{}, {}] } }, { latest_version: null }, { latest_version: { citations: [{}] } }] })).toBe(3)
  expect(citationCount(null)).toBe(0)
})
