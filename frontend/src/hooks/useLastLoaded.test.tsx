import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { useLastLoaded } from './useLastLoaded'

function setup() {
  const qc = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return { qc, wrapper }
}

describe('useLastLoaded', () => {
  it('returns nothing when nothing under the prefix has loaded', () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => useLastLoaded(['projects', 'list']), { wrapper })
    expect(result.current).toBeUndefined()
  })

  it('returns the newest successful result under the prefix, ignoring other branches', () => {
    const { qc, wrapper } = setup()
    qc.setQueryData(['projects', 'list', { page: 1 }], 'older', { updatedAt: 1000 })
    qc.setQueryData(['projects', 'list', { page: 2 }], 'newer', { updatedAt: 2000 })
    qc.setQueryData(['library', 'list'], 'other branch', { updatedAt: 3000 })
    const { result } = renderHook(() => useLastLoaded<string>(['projects', 'list']), { wrapper })
    expect(result.current).toBe('newer')
  })

  it('skips a query that failed, so a failed filter falls back to the list that did load', async () => {
    const { qc, wrapper } = setup()
    qc.setQueryData(['projects', 'list', { q: '' }], 'good list', { updatedAt: 1000 })
    await qc
      .fetchQuery({
        queryKey: ['projects', 'list', { q: 'broken' }],
        queryFn: () => Promise.reject(new Error('boom')),
        retry: false,
      })
      .catch(() => undefined)
    const { result } = renderHook(() => useLastLoaded<string>(['projects', 'list']), { wrapper })
    expect(result.current).toBe('good list')
  })
})
