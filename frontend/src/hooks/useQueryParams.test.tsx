import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDraftParam, useQueryParams } from './useQueryParams'

const wrapper = (initial: string) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>
  }

/** The hook under test plus the real address, so a test can read it and move it like a browser would. */
function setup(initial: string, hook: () => unknown) {
  return renderHook(
    () => ({ hook: hook(), location: useLocation(), navigate: useNavigate() }),
    { wrapper: wrapper(initial) },
  )
}

describe('useQueryParams', () => {
  it('reads text, ids, choices and the page with safe fallbacks', () => {
    const { result } = setup('/x?q=wudu&item=7&tab=chains&page=3&bad=-4', () => useQueryParams())
    const p = result.current.hook as ReturnType<typeof useQueryParams>
    expect(p.text('q')).toBe('wudu')
    expect(p.text('missing')).toBe('')
    expect(p.id('item')).toBe(7)
    expect(p.id('bad')).toBeUndefined()
    expect(p.id('q')).toBeUndefined()
    expect(p.oneOf('tab', ['occ', 'chains'] as const, 'occ')).toBe('chains')
    expect(p.oneOf('tab', ['occ', 'dossier'] as const, 'occ')).toBe('occ')
    expect(p.page).toBe(3)
  })

  it('defaults the page to 1 when it is absent or nonsense', () => {
    expect((setup('/x', () => useQueryParams()).result.current.hook as ReturnType<typeof useQueryParams>).page).toBe(1)
    expect((setup('/x?page=abc', () => useQueryParams()).result.current.hook as ReturnType<typeof useQueryParams>).page).toBe(1)
  })

  it('removes empty values so defaults stay out of the address, and resets the page unless told not to', () => {
    const { result } = setup('/x?scope=owned&page=4&tag=a', () => useQueryParams())
    const api = () => result.current.hook as ReturnType<typeof useQueryParams>
    act(() => api().set({ tag: null, stage: 'writing' }))
    expect(result.current.location.search).toBe('?scope=owned&stage=writing')
    act(() => api().set({ item: 5 }, { keepPage: true }))
    expect(result.current.location.search).toContain('item=5')
    act(() => api().set({ page: 2 }))
    expect(new URLSearchParams(result.current.location.search).get('page')).toBe('2')
  })

  it('merges two updates made in the same event instead of letting the second overwrite the first', () => {
    const { result } = setup('/x?q=a', () => useQueryParams())
    const api = () => result.current.hook as ReturnType<typeof useQueryParams>
    act(() => {
      api().set({ stage: 'writing' })
      api().set({ tag: 'canonical' })
    })
    const sp = new URLSearchParams(result.current.location.search)
    expect([sp.get('q'), sp.get('stage'), sp.get('tag')]).toEqual(['a', 'writing', 'canonical'])
  })

  it('replaces the history entry instead of adding one, so Back leaves the screen', () => {
    const { result } = setup('/x', () => useQueryParams())
    act(() => (result.current.hook as ReturnType<typeof useQueryParams>).set({ q: 'a' }))
    act(() => (result.current.hook as ReturnType<typeof useQueryParams>).set({ q: 'ab' }))
    expect(result.current.location.search).toBe('?q=ab')
    act(() => result.current.navigate(-1))
    // Nothing earlier in the memory history, so we are still at the first entry: no extra entries were pushed.
    expect(result.current.location.pathname).toBe('/x')
  })

  it('push adds a history entry (moving between views), so Back returns to the previous one', () => {
    const { result } = setup('/x', () => useQueryParams())
    const api = () => result.current.hook as ReturnType<typeof useQueryParams>
    act(() => api().replaceAll({ view: 'new' }, { push: true }))
    expect(result.current.location.search).toBe('?view=new')
    act(() => api().set({ view: 'manifest', job: 4 }, { push: true }))
    expect(result.current.location.search).toBe('?view=manifest&job=4')
    act(() => result.current.navigate(-1))
    expect(result.current.location.search).toBe('?view=new')
    act(() => result.current.navigate(-1))
    expect(result.current.location.search).toBe('')
  })

  it('replaceAll clears everything', () => {
    const { result } = setup('/x?q=a&tag=b&page=2', () => useQueryParams())
    act(() => (result.current.hook as ReturnType<typeof useQueryParams>).replaceAll())
    expect(result.current.location.search).toBe('')
  })
})

describe('useDraftParam', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const draft = (r: { current: { hook: unknown } }) => r.current.hook as ReturnType<typeof useDraftParam>

  it('shows what is typed at once and applies it to the address only after the pause', () => {
    const { result } = setup('/x', () => useDraftParam('q', { delay: 300 }))
    act(() => draft(result).setText('wu'))
    expect(draft(result).text).toBe('wu')
    expect(result.current.location.search).toBe('')
    act(() => vi.advanceTimersByTime(299))
    expect(result.current.location.search).toBe('')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.location.search).toBe('?q=wu')
    expect(draft(result).text).toBe('wu')
  })

  it('applies only the last text when typing continues (one change, not one per key)', () => {
    const { result } = setup('/x', () => useDraftParam('q', { delay: 300 }))
    act(() => draft(result).setText('w'))
    act(() => vi.advanceTimersByTime(200))
    act(() => draft(result).setText('wu'))
    act(() => vi.advanceTimersByTime(200))
    expect(result.current.location.search).toBe('')
    act(() => vi.advanceTimersByTime(100))
    expect(result.current.location.search).toBe('?q=wu')
  })

  it('goes back to page 1 when the text is applied, and trims it', () => {
    const { result } = setup('/x?page=5&q=old', () => useDraftParam('q', { delay: 300 }))
    act(() => draft(result).setText('  new  '))
    act(() => vi.advanceTimersByTime(300))
    expect(result.current.location.search).toBe('?q=new')
  })

  it('follows the address when it changes from outside, without an effect copying it (back button)', () => {
    const { result } = setup('/x?q=first', () => useDraftParam('q', { delay: 300 }))
    expect(draft(result).text).toBe('first')
    act(() => draft(result).setText('first and more'))
    act(() => vi.advanceTimersByTime(300))
    expect(draft(result).text).toBe('first and more')
    act(() => result.current.navigate('/x?q=elsewhere'))
    expect(draft(result).text).toBe('elsewhere')
  })

  it('applies at once with commit (a form submit), cancelling the pending timer', () => {
    const { result } = setup('/x', () => useDraftParam('q'))
    act(() => draft(result).setText('wudu'))
    expect(result.current.location.search).toBe('')
    act(() => draft(result).commit())
    expect(result.current.location.search).toBe('?q=wudu')
  })

  it('removes the parameter when the text is cleared', () => {
    const { result } = setup('/x?q=wudu', () => useDraftParam('q', { delay: 300 }))
    act(() => draft(result).setText(''))
    act(() => vi.advanceTimersByTime(300))
    expect(result.current.location.search).toBe('')
    expect(draft(result).text).toBe('')
  })

  it('reset forgets an unapplied draft', () => {
    const { result } = setup('/x', () => useDraftParam('q'))
    act(() => draft(result).setText('typed but never applied'))
    act(() => draft(result).reset())
    expect(draft(result).text).toBe('')
  })

  it('does not apply anything after it is unmounted', () => {
    const { result, unmount } = setup('/x', () => useDraftParam('q', { delay: 300 }))
    act(() => draft(result).setText('late'))
    unmount()
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.location.search).toBe('')
  })
})
