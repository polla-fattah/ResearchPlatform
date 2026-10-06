import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useKeyedSelection } from './useKeyedSelection'

describe('useKeyedSelection', () => {
  it('starts empty, ticks and unticks one item', () => {
    const { result } = renderHook(() => useKeyedSelection('page-1'))
    expect(result.current.selected.size).toBe(0)
    act(() => result.current.toggle('a'))
    expect(result.current.selected.has('a')).toBe(true)
    act(() => result.current.toggle('a'))
    expect(result.current.selected.has('a')).toBe(false)
  })

  it('keeps every tick when several are made in the same event', () => {
    const { result } = renderHook(() => useKeyedSelection('page-1'))
    act(() => {
      result.current.toggle('a')
      result.current.toggle('b')
      result.current.setMany(['c', 'd'], true)
    })
    expect([...result.current.selected].sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('ticks and unticks a group', () => {
    const { result } = renderHook(() => useKeyedSelection('page-1'))
    act(() => result.current.setMany(['a', 'b', 'c'], true))
    act(() => result.current.setMany(['a', 'b'], false))
    expect([...result.current.selected]).toEqual(['c'])
  })

  it('forgets the selection as soon as the scope changes, without an effect, and starts fresh', () => {
    const { result, rerender } = renderHook(({ scope }) => useKeyedSelection(scope), { initialProps: { scope: 'page-1' } })
    act(() => result.current.toggle('a'))
    expect(result.current.selected.size).toBe(1)
    rerender({ scope: 'page-2' })
    expect(result.current.selected.size).toBe(0)
    act(() => result.current.toggle('b'))
    expect([...result.current.selected]).toEqual(['b'])
    // Going back to the first scope does not resurrect its old ticks.
    rerender({ scope: 'page-1' })
    expect(result.current.selected.size).toBe(0)
  })

  it('clear empties the selection', () => {
    const { result } = renderHook(() => useKeyedSelection('page-1'))
    act(() => result.current.setMany(['a', 'b'], true))
    act(() => result.current.clear())
    expect(result.current.selected.size).toBe(0)
  })
})
