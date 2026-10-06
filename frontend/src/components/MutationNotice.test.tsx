import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api/errors'
import { AppProviders } from '@/app/providers'
import { createQueryClient } from '@/app/queryClient'
import { MutationNotice } from './MutationNotice'

const show = (error: unknown, title?: string) =>
  render(
    <AppProviders client={createQueryClient()}>
      <MutationNotice error={error} title={title} />
    </AppProviders>,
  )

describe('MutationNotice', () => {
  it('shows nothing while there is no error', () => {
    show(null, 'The change wasn’t saved')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the title and the message written for people when the server refused (4xx)', () => {
    show(new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'The title is required.' }), 'The project wasn’t saved')
    expect(screen.getByRole('alert')).toHaveTextContent('The project wasn’t saved. The title is required.')
  })

  it('never shows server error text (5xx)', () => {
    show(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'SQLSTATE[23505]: insert into "library_items"' }))
    expect(screen.getByRole('alert')).not.toHaveTextContent('SQLSTATE')
    expect(screen.getByRole('alert')).toHaveTextContent("The server didn't respond in time")
  })

  it('says a dropped connection is a connection problem', () => {
    show(new ApiError({ status: 0, code: 'NETWORK', message: 'The server did not respond.' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/connection|reach|respond/i)
  })

  it('says it plainly when the server accepted a write but did not keep it', () => {
    show(new ApiError({ status: 200, code: 'NOT_PERSISTED', message: 'x', details: { what: 'tags' } }), 'That change wasn’t saved')
    expect(screen.getByRole('alert')).toHaveTextContent('The server accepted the request but did not keep your tags. Nothing was changed.')
  })

  it('names an unknown field by its own name rather than hiding it', () => {
    show(new ApiError({ status: 200, code: 'NOT_PERSISTED', message: 'x', details: { what: 'colour' } }))
    expect(screen.getByRole('alert')).toHaveTextContent('did not keep your colour')
  })

  it('shows a plain Error with the fallback, not its message', () => {
    show(new Error('internal detail'))
    expect(screen.getByRole('alert')).not.toHaveTextContent('internal detail')
  })
})
