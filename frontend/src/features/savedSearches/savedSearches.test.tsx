import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { envelope, mockMe, project, renderApp } from '@/test/helpers'
import { mockProjectList } from '@/test/projectMocks'
import { server } from '@/test/server'

const pg = (total: number, page = 1, perPage = 20) => ({
  pagination: { current_page: page, per_page: perPage, total_items: total, total_pages: Math.max(1, Math.ceil(total / perPage)), has_more: page * perPage < total },
})

const search = (over: Record<string, unknown> = {}) => ({
  id: 31,
  owner_type: 'user',
  owner_id: 1,
  name: 'wuḍūʾ thalāthan',
  query_text: 'وضوء ثلاثا',
  search_mode: 'exact',
  filter_criteria: { hukm_id: 6, narrator_id: 9, narrator_label: 'جابر بن زيد' },
  created_at: '2026-10-04T10:00:00Z',
  ...over,
})

interface Apis {
  items?: Record<string, unknown>[]
  total?: number
  list?: () => Response | undefined
  patch?: (body: Record<string, unknown>) => Response | undefined
  del?: () => Response | undefined
}

function mockSaved(o: Apis = {}) {
  const items = o.items ?? [search()]
  const calls = { pages: [] as number[], patched: [] as { id: string; body: Record<string, unknown> }[], deleted: [] as string[] }
  server.use(
    http.get('*/api/v1/saved-searches', ({ request }) => {
      const page = Number(new URL(request.url).searchParams.get('page') ?? 1)
      calls.pages.push(page)
      return o.list?.() ?? HttpResponse.json(envelope(items, pg(o.total ?? items.length, page)))
    }),
    http.patch('*/api/v1/saved-searches/:id', async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.patched.push({ id: String(params.id), body })
      const custom = o.patch?.(body)
      if (custom) return custom
      const found = items.find((i) => i.id === Number(params.id))
      if (found) Object.assign(found, body)
      return HttpResponse.json(envelope(found))
    }),
    http.delete('*/api/v1/saved-searches/:id', ({ params }) => {
      calls.deleted.push(String(params.id))
      const custom = o.del?.()
      if (custom) return custom
      const at = items.findIndex((i) => i.id === Number(params.id))
      if (at >= 0) items.splice(at, 1)
      return HttpResponse.json(envelope(null))
    }),
    http.get('*/api/v1/corpus/hukms', () => HttpResponse.json(envelope([{ id: 6, name: 'Sa7ee7', label: 'صحيح', arabic_name: 'صحيح' }]))),
  )
  return calls
}

describe('Saved searches (account)', () => {
  it('lists the account’s own searches with their text, mode, filters and code, and says they are only the person’s', async () => {
    mockMe()
    mockSaved()
    renderApp('/searches', { signedIn: true })
    expect(await screen.findByRole('heading', { level: 1, name: 'Saved searches' })).toBeInTheDocument()
    expect(screen.getByText('Searches only you can see. They belong to your account, not to a project.')).toBeInTheDocument()
    const card = (await screen.findByText('wuḍūʾ thalāthan')).closest('li')!
    expect(within(card).getByText('SQ-0031')).toBeInTheDocument()
    expect(within(card).getByText('وضوء ثلاثا')).toBeInTheDocument()
    expect(within(card).getByText('Exact original text')).toBeInTheDocument()
    expect(await within(card).findByText('Ruling: صحيح · Narrator: جابر بن زيد')).toBeInTheDocument()
    expect(screen.getByText('1 saved search')).toBeInTheDocument()
  })

  it('says it cannot be run on its own yet', async () => {
    mockMe()
    mockSaved()
    renderApp('/searches', { signedIn: true })
    expect(await screen.findByText(/can't be run on its own yet/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Run/ })).not.toBeInTheDocument()
  })

  it('explains how to save one when there are none', async () => {
    mockMe()
    mockSaved({ items: [] })
    renderApp('/searches', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'No saved searches yet' })).toBeInTheDocument()
    expect(screen.getByText(/pick “Only me”/)).toBeInTheDocument()
  })

  it('says it could not load, with a retry, and does not show the server’s words', async () => {
    mockMe()
    mockSaved({ list: () => HttpResponse.json({ success: false, error: { message: 'SQLSTATE boom' } }, { status: 500 }) })
    renderApp('/searches', { signedIn: true })
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText(/SQLSTATE/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('pages through the list, keeping the page in the address', async () => {
    mockMe()
    const calls = mockSaved({ total: 45 })
    const { router } = renderApp('/searches', { signedIn: true })
    await screen.findByText('wuḍūʾ thalāthan')
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(router.state.location.search).toBe('?page=2'))
    await waitFor(() => expect(calls.pages).toContain(2))
  })

  it('renames a search and shows the new name', async () => {
    mockMe()
    const calls = mockSaved()
    renderApp('/searches', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Rename wuḍūʾ thalāthan' }))
    const dialog = await screen.findByRole('dialog', { name: 'Rename saved search' })
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled()
    const name = within(dialog).getByLabelText(/Name/)
    await userEvent.clear(name)
    await userEvent.type(name, 'wudu x3')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(calls.patched).toEqual([{ id: '31', body: { name: 'wudu x3' } }]))
    expect(await screen.findByText('wudu x3')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not call a rename done when the server answered 200 but kept the old name', async () => {
    mockMe()
    mockSaved({ patch: () => HttpResponse.json(envelope(search())) })
    renderApp('/searches', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Rename wuḍūʾ thalāthan' }))
    const dialog = await screen.findByRole('dialog', { name: 'Rename saved search' })
    const name = within(dialog).getByLabelText(/Name/)
    await userEvent.clear(name)
    await userEvent.type(name, 'new name')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent("The search wasn't renamed")
    expect(screen.getByText('wuḍūʾ thalāthan')).toBeInTheDocument()
  })

  it('deletes only after confirmation, and only that search', async () => {
    mockMe()
    const calls = mockSaved({ items: [search(), search({ id: 32, name: 'second' })] })
    renderApp('/searches', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Delete wuḍūʾ thalāthan' }))
    const dialog = await screen.findByRole('dialog')
    expect(calls.deleted).toEqual([])
    expect(within(dialog).getByText(/Searches saved in projects, and their runs, are not affected/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete saved search' }))
    await waitFor(() => expect(calls.deleted).toEqual(['31']))
    await waitFor(() => expect(screen.queryByText('wuḍūʾ thalāthan')).not.toBeInTheDocument())
    expect(screen.getByText('second')).toBeInTheDocument()
  })

  it('says a failed delete did not happen', async () => {
    mockMe()
    mockSaved({ del: () => HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'gone' } }, { status: 404 }) })
    renderApp('/searches', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Delete wuḍūʾ thalāthan' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete saved search' }))
    expect(await screen.findByText(/The saved search wasn't deleted/)).toBeInTheDocument()
  })

  it('opens a search in a project of the person’s choosing, with the text, mode and filters filled in, and runs nothing', async () => {
    mockMe()
    mockSaved()
    mockProjectList({ owned: [project({ id: 12 })], shared: [project({ id: 14, title: 'A shared project', my_role: 'viewer' }), project({ id: 12 })] })
    const { router } = renderApp('/searches', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Open in a project… wuḍūʾ thalāthan' }))
    const dialog = await screen.findByRole('dialog', { name: /Open “wuḍūʾ thalāthan” in a project/ })
    await within(dialog).findByRole('button', { name: /A shared project/ })
    expect(within(dialog).getAllByRole('button').filter((b) => /Chains of the wuḍūʾ/.test(b.textContent ?? ''))).toHaveLength(1)
    await userEvent.click(within(dialog).getByRole('button', { name: /A shared project/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/projects/14/searches'))
    const params = new URLSearchParams(router.state.location.search)
    expect(Object.fromEntries(params)).toEqual({ q: 'وضوء ثلاثا', mode: 'exact', hukm: '6', narrator: '9', nlabel: 'جابر بن زيد' })
  })

  it('says there is no project to open it in', async () => {
    mockMe()
    mockSaved()
    mockProjectList({})
    renderApp('/searches', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Open in a project… wuḍūʾ thalāthan' }))
    expect(await screen.findByText('You have no project to open it in yet.')).toBeInTheDocument()
  })
})
