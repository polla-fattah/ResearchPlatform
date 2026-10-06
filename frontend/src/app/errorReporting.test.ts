import { afterEach, describe, expect, it, vi } from 'vitest'
import { listenForUnhandledErrors, reportError, setErrorReporter } from './errorReporting'

afterEach(() => setErrorReporter(null))

describe('error reporting', () => {
  it('passes an error and where it came from to the reporter that was set', () => {
    const seen = vi.fn()
    setErrorReporter(seen)
    const error = new Error('x')
    reportError(error, 'route')
    expect(seen).toHaveBeenCalledWith(error, 'route')
  })

  it('does nothing visible and does not throw when no reporter is set or the reporter fails', () => {
    expect(() => reportError(new Error('x'), 'route')).not.toThrow()
    setErrorReporter(() => {
      throw new Error('down')
    })
    expect(() => reportError(new Error('x'), 'route')).not.toThrow()
  })

  it('reports errors and unhandled rejections from the window', () => {
    const handlers: Record<string, (e: unknown) => void> = {}
    listenForUnhandledErrors({ addEventListener: (type: string, h: (e: unknown) => void) => void (handlers[type] = h) } as unknown as Window)
    const seen = vi.fn()
    setErrorReporter(seen)
    handlers.error!({ error: new Error('script'), message: 'script' })
    handlers.unhandledrejection!({ reason: 'nobody awaited' })
    expect(seen.mock.calls.map((c) => c[1])).toEqual(['window', 'promise'])
  })
})
