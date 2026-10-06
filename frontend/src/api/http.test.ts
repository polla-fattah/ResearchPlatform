import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { server } from '@/test/server'
import { envelope } from '@/test/helpers'
import { setErrorReporter } from '@/app/errorReporting'
import { ApiError } from './errors'
import { api, session } from './http'

describe('api()', () => {
  it('unwraps the envelope and exposes pagination', async () => {
    server.use(
      http.get('*/api/v1/things', () =>
        HttpResponse.json(
          envelope([{ id: 1 }], {
            pagination: { current_page: 2, per_page: 1, total_items: 5, total_pages: 5, has_more: true },
          }),
        ),
      ),
    )
    const res = await api('/things', {
      query: { page: 2, q: undefined },
      schema: z.array(z.object({ id: z.number() })),
    })
    expect(res.data).toEqual([{ id: 1 }])
    expect(res.pagination?.total_pages).toBe(5)
  })

  it('sends the bearer token and an idempotency key when asked', async () => {
    let seen: Headers | undefined
    server.use(
      http.post('*/api/v1/exports', ({ request }) => {
        seen = request.headers
        return HttpResponse.json(envelope({ job_id: 1 }), { status: 201 })
      }),
    )
    session.set('abc')
    await api('/exports', { method: 'POST', body: {}, idempotent: true })
    expect(seen?.get('authorization')).toBe('Bearer abc')
    expect(seen?.get('idempotency-key')).toMatch(/[0-9a-f-]{36}/)
  })

  it('clears the session and notifies on 401', async () => {
    server.use(
      http.get('*/api/v1/auth/me', () => HttpResponse.json({ message: 'Unauthenticated.' }, { status: 401 })),
    )
    const handler = vi.fn()
    session.onUnauthenticated(handler)
    session.set('expired')
    await expect(api('/auth/me')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
    expect(session.get()).toBeNull()
    expect(handler).toHaveBeenCalledOnce()
    session.onUnauthenticated(null)
  })

  it('does not treat a failed sign-in (401 without a token) as a session expiry', async () => {
    server.use(
      http.post('*/api/v1/auth/login', () =>
        HttpResponse.json(
          { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Bad', details: [] } },
          { status: 401 },
        ),
      ),
    )
    const handler = vi.fn()
    session.onUnauthenticated(handler)
    await expect(api('/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    })
    expect(handler).not.toHaveBeenCalled()
    session.onUnauthenticated(null)
  })

  it('reports a network failure as NETWORK', async () => {
    server.use(http.get('*/api/v1/down', () => HttpResponse.error()))
    await expect(api('/down')).rejects.toMatchObject({ code: 'NETWORK', status: 0 })
  })

  it('refuses a response that does not match the schema, in every build, and reports it without the data', async () => {
    const reported: [unknown, string][] = []
    setErrorReporter((e, where) => reported.push([e, where]))
    server.use(http.get('*/api/v1/bad', () => HttpResponse.json(envelope({ id: 'a secret value' }))))
    const err = await api('/bad', { schema: z.object({ id: z.number() }) }).catch((e: unknown) => e)
    setErrorReporter(null)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).code).toBe('CONTRACT_MISMATCH')
    expect(reported).toHaveLength(1)
    expect(reported[0]![1]).toBe('contract')
    expect(JSON.stringify(reported[0]![0])).not.toContain('a secret value')
  })
})
