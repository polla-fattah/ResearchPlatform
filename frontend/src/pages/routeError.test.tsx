import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setErrorReporter } from '@/app/errorReporting'
import { RouteError } from './RouteError'

function Boom({ message, name = 'Error' }: { message: string; name?: string }): never {
  const e = new Error(message)
  e.name = name
  throw e
}

function show(element: React.ReactNode) {
  vi.spyOn(console, 'error').mockImplementation(() => undefined) // React logs the error it catches
  const router = createMemoryRouter([{ path: '/', element, errorElement: <RouteError /> }], { initialEntries: ['/'] })
  return render(<RouterProvider router={router} />)
}

afterEach(() => {
  setErrorReporter(null)
  vi.restoreAllMocks()
})

describe('RouteError', () => {
  it('shows a plain message, never the error text, and hands the error to the reporter', async () => {
    const reported: [unknown, string][] = []
    setErrorReporter((e, where) => reported.push([e, where]))
    show(<Boom message="Cannot read properties of undefined (reading 'secret') at /src/app/internal.ts:12" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong on this page')
    expect(document.body).not.toHaveTextContent('secret')
    expect(document.body).not.toHaveTextContent('internal.ts')
    expect(reported).toHaveLength(1)
    expect(reported[0]![1]).toBe('route')
    expect((reported[0]![0] as Error).message).toContain('secret')
  })

  it('tells a page that could not be fetched apart, and offers to reload', async () => {
    show(<Boom message="Failed to fetch dynamically imported module: https://example.org/assets/Page-abc.js" />)
    expect(await screen.findByRole('heading', { name: 'This page could not be loaded' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload the page' })).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('example.org')
  })

  it('does not break if the reporter itself fails', async () => {
    setErrorReporter(() => {
      throw new Error('reporter down')
    })
    show(<Boom message="x" />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
