import { describe, expect, it } from 'vitest'
import type { Candidate, EditorSubmission } from '@/api/schemas/editorial'
import { ageDays, assignable, canApprove, canDecide, canRelease, caseStage, finishedReviews, matchesCandidate, releaseConfirmed, tomorrow, waitingOn } from './editorialModel'

const sub = (over: Partial<EditorSubmission> = {}): EditorSubmission => ({ id: 1, version_number: 1, title: 't', status: 'submitted', ...over })
const done = { id: 1, completed_at: '2026-10-01T00:00:00Z' }
const open = { id: 2, completed_at: null }

describe('caseStage and waitingOn', () => {
  it('names where a package stands and who acts next', () => {
    expect(caseStage(sub())).toBe('triage')
    expect(waitingOn('triage')).toBe('editor_assign')
    expect(caseStage(sub({ status: 'in_review', reviews: [open] }))).toBe('under_review')
    expect(waitingOn('under_review')).toBe('reviewers')
    expect(caseStage(sub({ status: 'in_review', reviews: [open, done] }))).toBe('ready_for_decision')
    expect(waitingOn('ready_for_decision')).toBe('editor_decide')
    expect(caseStage(sub({ status: 'revision_requested' }))).toBe('revisions_pending')
    expect(waitingOn('revisions_pending')).toBe('authors')
    expect(caseStage(sub({ status: 'approved' }))).toBe('approved')
    expect(waitingOn('approved')).toBe('editor_release')
    expect(caseStage(sub({ status: 'rejected' }))).toBe('rejected')
    expect(waitingOn('rejected')).toBeNull()
  })
  it('a released package is released, and a retracted one is retracted, whatever its status says', () => {
    expect(caseStage(sub({ status: 'approved', publication: { id: 1, status: 'published' } }))).toBe('released')
    expect(caseStage(sub({ status: 'approved', publication: { id: 1, status: 'retracted' } }))).toBe('retracted')
  })
})

describe('what can be done', () => {
  it('decides only while waiting or under review and before release', () => {
    expect(canDecide(sub())).toBe(true)
    expect(canDecide(sub({ status: 'in_review' }))).toBe(true)
    expect(canDecide(sub({ status: 'approved' }))).toBe(false)
    expect(canDecide(sub({ status: 'in_review', publication: { id: 1 } }))).toBe(false)
  })
  it('approves only after a finished review', () => {
    expect(canApprove(sub({ reviews: [open] }))).toBe(false)
    expect(canApprove(sub({ reviews: [done] }))).toBe(true)
    expect(finishedReviews(sub())).toBe(0)
  })
  it('releases only an approved package that was not released', () => {
    expect(canRelease(sub({ status: 'approved' }))).toBe(true)
    expect(canRelease(sub({ status: 'approved', publication: { id: 1 } }))).toBe(false)
    expect(canRelease(sub({ status: 'submitted' }))).toBe(false)
  })
})

describe('candidates', () => {
  const c = (id: number, blocked: boolean, name = `N${id}`): Candidate => ({ id, display_name: name, affiliation: 'Soran University', coi: { blocked, reason: blocked ? 'team' : null } })
  it('offers those without a conflict who are not already assigned', () => {
    expect(assignable([c(1, false), c(2, true), c(3, false)], new Set([3])).map((x) => x.id)).toEqual([1])
  })
  it('finds by any part of the name or affiliation', () => {
    expect(matchesCandidate(c(1, false, 'Leyla Mustafa'), 'mustafa')).toBe(true)
    expect(matchesCandidate(c(1, false), 'soran')).toBe(true)
    expect(matchesCandidate(c(1, false), 'xyz')).toBe(false)
    expect(matchesCandidate(c(1, false), '  ')).toBe(true)
  })
})

it('counts whole days since submission, never negative, and nothing for no date', () => {
  const now = Date.parse('2026-10-10T12:00:00Z')
  expect(ageDays('2026-10-07T00:00:00Z', now)).toBe(3)
  expect(ageDays('2026-10-11T00:00:00Z', now)).toBe(0)
  expect(ageDays(null, now)).toBeNull()
})

it('offers tomorrow as the first possible due day', () => {
  expect(tomorrow(new Date(2026, 9, 10, 15).getTime())).toBe('2026-10-11')
})

it('confirms a release only when the code is typed', () => {
  expect(releaseConfirmed(' sub-0007 ', 'SUB-0007')).toBe(true)
  expect(releaseConfirmed('SUB-0008', 'SUB-0007')).toBe(false)
  expect(releaseConfirmed('', 'SUB-0007')).toBe(false)
})
