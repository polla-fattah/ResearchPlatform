import { describe, expect, it } from 'vitest'
import type { Issue, Submission } from '@/api/schemas/submission'
import { canFreeze, completedReviews, defaultTitle, errorsOf, issueHref, latestOf, nextStep, shortChecksum, warningsOf } from './submissionModel'

const sub = (version_number: number, status: string, over: Partial<Submission> = {}): Submission => ({ id: version_number, version_number, title: 't', status, ...over })
const issue = (code: string, severity = 'error', over: Partial<Issue> = {}): Issue => ({ code, severity, ...over })

describe('nextStep', () => {
  it('lets the first package be made, a revision be answered, and nothing else while one is in play', () => {
    expect(nextStep(null)).toBe('first')
    expect(nextStep(sub(1, 'revision_requested'))).toBe('respond')
    expect(nextStep(sub(1, 'submitted'))).toBe('wait')
    expect(nextStep(sub(1, 'in_review'))).toBe('wait')
    expect(nextStep(sub(1, 'approved'))).toBe('closed')
    expect(nextStep(sub(1, 'rejected'))).toBe('closed')
  })
  it('judges by the newest version, whatever the order', () => {
    expect(latestOf([sub(1, 'revision_requested'), sub(3, 'submitted'), sub(2, 'rejected')])?.version_number).toBe(3)
    expect(latestOf([])).toBeNull()
  })
})

it('counts finished reviews without naming anyone', () => {
  expect(completedReviews({ reviews: [{ completed_at: '2026-10-01' }, { completed_at: null }, {}] })).toBe(1)
  expect(completedReviews({})).toBe(0)
})

it('shortens a checksum and offers a title', () => {
  expect(shortChecksum('abcdef0123456789')).toBe('abcdef012345')
  expect(shortChecksum(null)).toBe('')
  expect(defaultTitle('Project', [{ title: 'The article' }])).toBe('The article')
  expect(defaultTitle('Project', [{ title: 'A' }, { title: 'B' }])).toBe('Project')
  expect(defaultTitle('Project', [])).toBe('Project')
})

describe('issues', () => {
  it('separates errors, which stop a submission, from warnings, which do not', () => {
    const all = [issue('NO_DOCUMENTS', 'warning'), issue('DOCUMENT_NO_VERSION'), issue('X', undefined as unknown as string)]
    expect(errorsOf(all).map((i) => i.code)).toEqual(['DOCUMENT_NO_VERSION', 'X'])
    expect(warningsOf(all).map((i) => i.code)).toEqual(['NO_DOCUMENTS'])
  })
  it('leads each issue to where it is fixed', () => {
    expect(issueHref(12, issue('UNRESOLVED_EVIDENCE_DEPENDENCY', 'error', { document_id: 4 }))).toBe('/projects/12/findings?doc=4')
    expect(issueHref(12, issue('SUSPENDED_PARTICIPANT'))).toBe('/projects/12/members')
    expect(issueHref(12, issue('NO_DOCUMENTS', 'warning'))).toBe('/projects/12/findings')
    expect(issueHref(12, issue('SOMETHING'))).toBeNull()
  })
})

describe('canFreeze', () => {
  const ok = { documentIds: [1], title: 'T', abstract: 'A', rightsConfirmed: true, coiConfirmed: true, response: null }
  it('needs a chosen document, text, both confirmations and a check with no errors', () => {
    expect(canFreeze(ok, [])).toBe(true)
    expect(canFreeze(ok, [issue('NO_DOCUMENTS', 'warning')])).toBe(true)
    expect(canFreeze(ok, [issue('DOCUMENT_NO_VERSION')])).toBe(false)
    expect(canFreeze(ok, null)).toBe(false)
    expect(canFreeze({ ...ok, documentIds: [] }, [])).toBe(false)
    expect(canFreeze({ ...ok, abstract: ' ' }, [])).toBe(false)
    expect(canFreeze({ ...ok, rightsConfirmed: false }, [])).toBe(false)
    expect(canFreeze({ ...ok, coiConfirmed: false }, [])).toBe(false)
  })
  it('needs an answer when the package answers a revision request', () => {
    expect(canFreeze({ ...ok, response: '' }, [])).toBe(false)
    expect(canFreeze({ ...ok, response: 'Added section 5.' }, [])).toBe(true)
  })
})
