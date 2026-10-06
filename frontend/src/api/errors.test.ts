import { describe, expect, it } from 'vitest'
import { normalizeError } from './errors'

describe('normalizeError: the three backend shapes', () => {
  it('reads the envelope shape', () => {
    const err = normalizeError(422, {
      success: false,
      error: { code: 'CONFLICT_OF_INTEREST', message: 'Conflict of interest.', details: [] },
    })
    expect(err.code).toBe('CONFLICT_OF_INTEREST')
    expect(err.message).toBe('Conflict of interest.')
    expect(err.status).toBe(422)
  })

  it('reads field errors from the envelope details', () => {
    const err = normalizeError(422, {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid', details: { email: ['Taken.'] } },
    })
    expect(err.fields).toEqual({ email: ['Taken.'] })
  })

  it("reads Laravel's 422 shape", () => {
    const err = normalizeError(422, {
      message: 'The email field is required. (and 1 more error)',
      errors: { email: ['The email field is required.'], password: ['The password field is required.'] },
    })
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.fields.email).toEqual(['The email field is required.'])
    expect(err.fields.password).toHaveLength(1)
  })

  it("reads Laravel's plain { message } shape", () => {
    const err = normalizeError(401, { message: 'Unauthenticated.' })
    expect(err.code).toBe('UNAUTHENTICATED')
    expect(err.message).toBe('Unauthenticated.')
  })

  it('maps the DEF-1 bug (HTTP 400 with code "404") to not found', () => {
    const err = normalizeError(400, {
      success: false,
      error: { code: '404', message: 'Hadith not found in canonical corpus.', details: [] },
    })
    expect(err.code).toBe('NOT_FOUND')
    expect(err.status).toBe(404)
  })

  it('survives a missing or non-JSON body', () => {
    const err = normalizeError(502, undefined)
    expect(err.code).toBe('UNKNOWN')
    expect(err.message).toContain('502')
  })

  it('carries Retry-After for rate limits', () => {
    const err = normalizeError(429, { message: 'Too Many Attempts.' }, '900')
    expect(err.code).toBe('RATE_LIMITED')
    expect(err.retryAfter).toBe(900)
  })
})

describe('ApiError helpers', () => {
  it('treats 403 and 404 the same so private objects are not revealed', () => {
    expect(normalizeError(403, { message: 'x' }).isNotAvailable).toBe(true)
    expect(normalizeError(404, { message: 'x' }).isNotAvailable).toBe(true)
    expect(normalizeError(500, { message: 'x' }).isNotAvailable).toBe(false)
  })

  it('detects conflicts', () => {
    expect(normalizeError(409, { message: 'x' }).isConflict).toBe(true)
  })
})
