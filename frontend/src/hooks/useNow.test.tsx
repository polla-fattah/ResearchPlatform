import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNow } from './useNow'

describe('useNow', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('returns the current time and moves it on once a minute', () => {
    vi.setSystemTime(new Date('2026-10-06T10:00:00Z'))
    const { result } = renderHook(() => useNow())
    const first = result.current
    expect(first).toBe(Date.parse('2026-10-06T10:00:00Z'))
    act(() => vi.advanceTimersByTime(30_000))
    expect(result.current).toBe(first)
    act(() => vi.advanceTimersByTime(30_000))
    expect(result.current).toBe(Date.parse('2026-10-06T10:01:00Z'))
  })

  it('shares one timer between components and stops it when none is listening', () => {
    const spy = vi.spyOn(globalThis, 'setInterval')
    const a = renderHook(() => useNow())
    const b = renderHook(() => useNow())
    expect(spy).toHaveBeenCalledTimes(1)
    a.unmount()
    b.unmount()
    expect(vi.getTimerCount()).toBe(0)
    spy.mockRestore()
  })

  it('refreshes a stale value when a component starts listening again', () => {
    vi.setSystemTime(new Date('2026-10-06T10:00:00Z'))
    const a = renderHook(() => useNow())
    a.unmount()
    vi.setSystemTime(new Date('2026-10-06T12:00:00Z'))
    const b = renderHook(() => useNow())
    expect(b.result.current).toBe(Date.parse('2026-10-06T12:00:00Z'))
  })
})
