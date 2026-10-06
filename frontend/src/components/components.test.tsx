import { render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError, normalizeError } from '@/api/errors'
import { AuthContext, type AuthState } from '@/app/authContext'
import { PreferencesProvider } from '@/app/preferences'
import { NeutralState, ProvenanceTag, VisibilityBadge } from './Badges'
import { BidiText } from './BidiText'
import { detectDirection } from './direction'
import { ConfirmAction } from './ConfirmAction'
import { CountedUnit } from './CountedUnit'
import { StateBoundary } from './StateBoundary'
import { viewStateOf, type ViewState } from './viewState'

describe('viewStateOf', () => {
  const base = { isPending: false, isError: false, error: null, data: [1] }

  it('maps query results onto the six states', () => {
    expect(viewStateOf({ ...base, isPending: true })).toBe('loading')
    expect(viewStateOf(base)).toBe('normal')
    expect(viewStateOf({ ...base, data: [] }, { isEmpty: (d) => (d as unknown[]).length === 0 })).toBe('empty')
    expect(viewStateOf({ ...base, isError: true, error: new Error('x') })).toBe('error')
    expect(viewStateOf({ ...base, isError: true, error: normalizeError(409, { message: 'x' }) })).toBe('conflict')
  })

  it('shows 403 and 404 identically as forbidden', () => {
    for (const status of [403, 404]) {
      const error = normalizeError(status, { message: 'x' })
      expect(viewStateOf({ ...base, isError: true, error })).toBe('forbidden')
    }
  })
})

describe('<StateBoundary>', () => {
  it.each<[ViewState, RegExp]>([
    ['empty', /nothing here yet/i],
    ['error', /didn't load/i],
    ['forbidden', /isn't available/i],
    ['conflict', /someone else changed this/i],
  ])('renders the %s panel', (state, text) => {
    render(<StateBoundary state={state}>content</StateBoundary>)
    expect(screen.getByText(text)).toBeInTheDocument()
    expect(screen.queryByText('content')).toBeNull()
  })

  it('renders children when normal and a labelled skeleton when loading', () => {
    const { rerender } = render(<StateBoundary state="normal">content</StateBoundary>)
    expect(screen.getByText('content')).toBeInTheDocument()
    rerender(<StateBoundary state="loading">content</StateBoundary>)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })

  it('offers retry on error and a network-specific message', async () => {
    const onRetry = vi.fn()
    const err = new ApiError({ status: 0, code: 'NETWORK', message: 'x' })
    render(
      <StateBoundary state="error" onRetry={onRetry} errorValue={err}>
        content
      </StateBoundary>,
    )
    expect(screen.getByText(/check your connection/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})

describe('<BidiText>', () => {
  it('detects direction from the first strong character', () => {
    expect(detectDirection('أَنَّ النَّبِيَّ')).toBe('rtl')
    expect(detectDirection('ئەم دەقە')).toBe('rtl')
    expect(detectDirection('Sunan Abī Dāwūd')).toBe('ltr')
    expect(detectDirection('123 — ')).toBeUndefined()
    expect(detectDirection('(Abū) أبو')).toBe('ltr')
  })

  it('keeps original wording untouched and isolates it', () => {
    const wording = 'تَوَضَّأَ ثَلاَثًا ثَلاَثًا'
    render(<BidiText lang="ar">{wording}</BidiText>)
    const el = screen.getByText(wording)
    expect(el).toHaveAttribute('dir', 'rtl')
    expect(el).toHaveAttribute('lang', 'ar')
    expect(el.textContent).toBe(wording)
  })

  it('lets the editor force a direction', () => {
    render(<BidiText dir="ltr">مرحبا</BidiText>)
    expect(screen.getByText('مرحبا')).toHaveAttribute('dir', 'ltr')
  })
})

describe('badges', () => {
  it('shows provenance as text plus icon', () => {
    render(<ProvenanceTag kind="attributed" name="al-Tirmidhī" />)
    expect(screen.getByText(/attributed to al-tirmidhī/i)).toBeInTheDocument()
  })

  it('shows visibility labels', () => {
    render(<VisibilityBadge visibility="private" />)
    expect(screen.getByText('Private')).toBeInTheDocument()
  })

  it('renders neutral states with their default text', () => {
    render(<NeutralState kind="incompleteCitation" />)
    expect(screen.getByText('Incomplete citation')).toBeInTheDocument()
  })
})

const signedOut = { status: 'anonymous', user: null, accountStatus: null, isApproved: false, isAdmin: false } as unknown as AuthState

describe('<CountedUnit>', () => {
  it('always carries the unit and pluralises', () => {
    render(
      <AuthContext.Provider value={signedOut}>
        <PreferencesProvider>
          <CountedUnit count={42} unit="occurrence" /> / <CountedUnit count={1} unit="occurrence" />
        </PreferencesProvider>
      </AuthContext.Provider>,
    )
    expect(screen.getByText(/42 occurrences/)).toBeInTheDocument()
    expect(screen.getByText(/1 occurrence(?!s)/)).toBeInTheDocument()
  })
})

describe('<ConfirmAction>', () => {
  it('confirms or cancels', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmAction open danger title="Move to trash?" confirmLabel="Move" onConfirm={onConfirm} onCancel={onCancel}>
        <p>Read-only for 30 days.</p>
      </ConfirmAction>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Cancel', hidden: true }))
    expect(onCancel).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: 'Move', hidden: true }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})

describe('focus returns to the button that opened a dialog', () => {
  it('Modal: when it is taken out of the page', async () => {
    const { Modal } = await import('./Modal')
    function Page() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open it
          </button>
          {open ? (
            <Modal title="A dialog" onClose={() => setOpen(false)}>
              <button type="button" onClick={() => setOpen(false)}>
                Close it
              </button>
            </Modal>
          ) : null}
        </>
      )
    }
    render(<Page />)
    const opener = screen.getByRole('button', { name: 'Open it' })
    opener.focus()
    await userEvent.click(opener)
    await userEvent.click(await screen.findByRole('button', { name: 'Close it' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Close it' })).not.toBeInTheDocument())
    expect(opener).toHaveFocus()
  })

  it('does not move focus when the button that opened it is gone', async () => {
    const { Modal } = await import('./Modal')
    function Page() {
      const [state, setState] = useState<'closed' | 'open' | 'gone'>('closed')
      return (
        <>
          {state !== 'gone' ? (
            <button type="button" onClick={() => setState('open')}>
              Open it
            </button>
          ) : null}
          <button type="button">Elsewhere</button>
          {state === 'open' ? (
            <Modal title="A dialog" onClose={() => setState('gone')}>
              <button type="button" onClick={() => setState('gone')}>
                Close it
              </button>
            </Modal>
          ) : null}
        </>
      )
    }
    render(<Page />)
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Close it' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Close it' })).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Elsewhere' })).not.toHaveFocus()
  })
})
