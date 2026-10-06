import type { z } from 'zod'
import { reportError } from '@/app/errorReporting'
import { ApiError, normalizeError } from './errors'

export interface Pagination {
  current_page: number
  per_page: number
  total_items: number
  total_pages: number
  has_more: boolean
}

export interface ApiResult<T> {
  data: T
  message: string
  pagination?: Pagination
  /** Everything else in `meta` (e.g. `counts` on GET /projects). */
  meta: Record<string, unknown>
}

export interface RequestOptions<S extends z.ZodType | undefined = undefined> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: Record<string, string | number | boolean | null | undefined>
  body?: unknown
  /** Validates `data`. Strict in dev and tests, a console warning in production. */
  schema?: S
  signal?: AbortSignal
  /** Adds an Idempotency-Key header (exports, submissions). */
  idempotent?: boolean
  /** Extra headers, e.g. If-Match. */
  headers?: Record<string, string>
}

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api/v1'
/**
 * A reply that does not match the shape a screen was written for is refused (the screen shows its error state with a retry),
 * in every build. Passing it on would hand code that trusts the shape either a crash or wrong data shown as fact. Only for an
 * emergency while the server and the app drift apart, `VITE_LENIENT_CONTRACT=1` turns this off: the mismatch is then logged
 * and the unchecked reply is used.
 */
const STRICT = import.meta.env.VITE_LENIENT_CONTRACT !== '1'

// ---- session token (memory + sessionStorage) -------------------------------
const TOKEN_KEY = 'oh.token'
const EXPIRED_KEY = 'oh.expired'
let token: string | null = null
let onUnauthenticated: (() => void) | null = null

export const session = {
  get(): string | null {
    if (token) return token
    try {
      token = sessionStorage.getItem(TOKEN_KEY)
    } catch {
      token = null
    }
    return token
  },
  set(value: string | null) {
    token = value
    try {
      if (value) sessionStorage.setItem(TOKEN_KEY, value)
      else sessionStorage.removeItem(TOKEN_KEY)
    } catch {
      /* storage unavailable: memory only */
    }
  },
  /** True once if the last session ended by a 401 (shown as "You were signed out"). Reading clears it. */
  consumeExpired(): boolean {
    try {
      const v = sessionStorage.getItem(EXPIRED_KEY) === '1'
      sessionStorage.removeItem(EXPIRED_KEY)
      return v
    } catch {
      return false
    }
  },
  markExpired() {
    try {
      sessionStorage.setItem(EXPIRED_KEY, '1')
    } catch {
      /* ignore */
    }
  },
  /** Called when an authenticated request comes back 401. */
  onUnauthenticated(handler: (() => void) | null) {
    onUnauthenticated = handler
  },
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const base = BASE.replace(/\/$/, '')
  const url = new URL(base + (path.startsWith('/') ? path : `/${path}`), window.location.origin)
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  }
  return url.href
}

/** Full URL for an API path, for requests that are not JSON (file downloads). */
export const apiUrl = buildUrl

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export async function api<S extends z.ZodType | undefined = undefined>(
  path: string,
  options: RequestOptions<S> = {},
): Promise<ApiResult<S extends z.ZodType ? z.output<S> : unknown>> {
  const { method = 'GET', query, body, schema, signal, idempotent, headers = {} } = options

  const h: Record<string, string> = { Accept: 'application/json', ...headers }
  const t = session.get()
  if (t) h.Authorization = `Bearer ${t}`
  if (body !== undefined) h['Content-Type'] = 'application/json'
  if (idempotent) h['Idempotency-Key'] = crypto.randomUUID()

  let res: Response
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers: h,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new ApiError({
      status: 0,
      code: 'NETWORK',
      message: 'The server did not respond.',
      details: cause,
    })
  }

  const json = await readJson(res)

  if (!res.ok) {
    const err = normalizeError(res.status, json, res.headers.get('Retry-After'))
    if (err.status === 401 && t) {
      session.set(null)
      session.markExpired()
      onUnauthenticated?.()
    }
    throw err
  }

  const envelope = (json ?? {}) as {
    data?: unknown
    message?: string
    meta?: { pagination?: Pagination } & Record<string, unknown>
  }
  let data: unknown = envelope.data

  if (schema) {
    const parsed = schema.safeParse(data)
    if (parsed.success) {
      data = parsed.data
    } else if (STRICT) {
      const mismatch = new ApiError({
        status: res.status,
        code: 'CONTRACT_MISMATCH',
        message: `Response from ${method} ${path} does not match the expected shape.`,
        details: parsed.error.issues,
      })
      reportError(mismatch, 'contract')
      throw mismatch
    } else {
      console.warn(`[contract] ${method} ${path}`, parsed.error.issues)
    }
  }

  return {
    data: data as never,
    message: envelope.message ?? '',
    pagination: envelope.meta?.pagination,
    meta: envelope.meta ?? {},
  }
}
