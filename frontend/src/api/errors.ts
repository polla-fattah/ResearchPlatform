/**
 * One error type for the three response shapes the backend produces today
 * (see docs/api/API_REQUESTS_FROM_FRONTEND.md, DEF-1):
 *   1. envelope      { success:false, error:{ code, message, details } }
 *   2. Laravel 422   { message, errors:{ field:[...] } }
 *   3. Laravel plain { message }   (401, policy 403, findOrFail 404)
 */
export type ApiErrorCode =
  | 'NETWORK'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'LOCKED'
  | 'GONE'
  | 'RATE_LIMITED'
  | 'CONTRACT_MISMATCH'
  | 'UNKNOWN'
  | (string & {}) // backend-specific codes such as CONFLICT_OF_INTEREST

export type FieldErrors = Record<string, string[]>

export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  readonly fields: FieldErrors
  readonly details: unknown
  readonly retryAfter?: number

  constructor(init: {
    status: number
    code: ApiErrorCode
    message: string
    fields?: FieldErrors
    details?: unknown
    retryAfter?: number
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.fields = init.fields ?? {}
    this.details = init.details
    this.retryAfter = init.retryAfter
  }

  /** Design rule: forbidden must never reveal whether a private object exists. */
  get isNotAvailable(): boolean {
    return this.status === 403 || this.status === 404
  }

  get isConflict(): boolean {
    return this.status === 409 || this.code === 'CONFLICT'
  }
}

const CODE_BY_STATUS: Record<number, ApiErrorCode> = {
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  410: 'GONE',
  422: 'VALIDATION_ERROR',
  423: 'LOCKED',
  429: 'RATE_LIMITED',
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function toFieldErrors(v: unknown): FieldErrors {
  if (!isRecord(v)) return {}
  const out: FieldErrors = {}
  for (const [k, val] of Object.entries(v)) {
    if (Array.isArray(val)) out[k] = val.map(String)
    else if (typeof val === 'string') out[k] = [val]
  }
  return out
}

/** Seconds to wait after a 429: the Retry-After header, or `details.retry_after` from the envelope. */
export function retryAfterSeconds(err: unknown): number | undefined {
  if (!(err instanceof ApiError)) return undefined
  if (err.retryAfter) return err.retryAfter
  const d = err.details
  if (typeof d === 'object' && d !== null && 'retry_after' in d) {
    const n = Number((d as { retry_after: unknown }).retry_after)
    if (Number.isFinite(n) && n > 0) return n
  }
  return undefined
}

/** Build an ApiError from an HTTP status and the (possibly absent) JSON body. */
export function normalizeError(
  status: number,
  body: unknown,
  retryAfterHeader?: string | null,
): ApiError {
  const retryAfter = retryAfterHeader ? Number(retryAfterHeader) || undefined : undefined
  let message = ''
  let code: ApiErrorCode | undefined
  let fields: FieldErrors = {}
  let details: unknown
  let effectiveStatus = status

  if (isRecord(body)) {
    if (isRecord(body.error)) {
      // shape 1: envelope
      message = String(body.error.message ?? '')
      code = typeof body.error.code === 'string' ? body.error.code : undefined
      details = body.error.details
      fields = toFieldErrors(body.error.details)
    } else {
      // shapes 2 and 3: Laravel defaults
      message = typeof body.message === 'string' ? body.message : ''
      fields = toFieldErrors(body.errors)
    }
  }

  // DEF-1: corpus "not found" is sent as HTTP 400 with error.code "404".
  if (code === '404') {
    code = 'NOT_FOUND'
    effectiveStatus = 404
  }

  return new ApiError({
    status: effectiveStatus,
    code: code ?? CODE_BY_STATUS[effectiveStatus] ?? 'UNKNOWN',
    message: message || `Request failed (${effectiveStatus})`,
    fields,
    details,
    retryAfter,
  })
}

/**
 * Text that is safe to show a researcher. Client errors (4xx) carry messages written for people.
 * Server errors (5xx) can carry raw exception text such as SQL, so they get the fallback instead.
 */
export function userMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.message) return err.message
  return fallback
}
