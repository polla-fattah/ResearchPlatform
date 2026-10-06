import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { envelope, mockMe, project, renderApp } from '@/test/helpers'
import { mockProjectApis, projectDetail } from '@/test/projectMocks'
import { server } from '@/test/server'

const MATN = 'أَنَّ النَّبِيَّ صلى الله عليه وسلم تَوَضَّأَ ثَلاَثًا'

const libItem = (over: Record<string, unknown> = {}) => ({
  id: 4,
  user_id: 1,
  resource_id: 88,
  is_favourite: false,
  personal_notes: null,
  locator: 'Vol. 1, Book 1, Hadith 1',
  excerpt_text: null,
  snapshot_data: { matn: MATN },
  source_status: 'current',
  merged_into: null,
  incomplete_citation_flags: '[]', // the backend sends JSON columns as strings (C-13)
  tags: '[]',
  notes: '[]',
  created_at: '2026-09-12T10:00:00Z',
  updated_at: '2026-09-12T10:00:00Z',
  resource: {
    id: 88,
    resource_type: 'corpus_hadith',
    corpus_table: 'hadiths',
    corpus_id: 1,
    title: 'Sahih al-Bukhari #1 — Bad’ al-Wahy',
    author: 'al-Bukhārī',
    source_metadata: [],
    collections: [],
  },
  ...over,
})

const counts = { total_saved: 3, favourites_count: 1, collections_count: 2 }
const pg = (n: number) => ({ pagination: { current_page: 1, per_page: 20, total_items: n, total_pages: 1, has_more: false } })

interface Apis {
  items?: unknown[]
  collections?: unknown[]
  tags?: string[]
  /** Reply to PUT /library/items/{id}/tags. */
  putTags?: (body: { tags: string[] }) => Response
  patch?: (body: Record<string, unknown>) => Response
}

function mockLibrary(o: Apis = {}) {
  const calls = { patch: [] as Record<string, unknown>[], put: [] as unknown[], deleted: [] as string[], lists: [] as URLSearchParams[] }
  const items = o.items ?? [libItem(), libItem({ id: 5, resource_id: 89, resource: { ...libItem().resource, id: 89, title: 'Sahih Muslim #1907', corpus_id: 1907 } })]
  server.use(
    http.get('*/api/v1/library/items', ({ request }) => {
      calls.lists.push(new URL(request.url).searchParams)
      return HttpResponse.json(envelope(items, { ...pg(items.length), counts }))
    }),
    http.get('*/api/v1/library/items/:id', ({ params }) => {
      const found = (items as { id: number }[]).find((i) => i.id === Number(params.id))
      return found
        ? HttpResponse.json(envelope(found))
        : HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 })
    }),
    http.get('*/api/v1/library/collections', () =>
      HttpResponse.json(envelope(o.collections ?? [{ id: 1, name: 'Chains', resources_count: 2 }, { id: 2, name: 'Narrators', resources_count: 1 }])),
    ),
    http.get('*/api/v1/library/tags', () => HttpResponse.json(envelope(o.tags ?? ['canonical']))),
    http.patch('*/api/v1/library/items/:id', async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.patch.push(body)
      if (o.patch) return o.patch(body)
      return HttpResponse.json(envelope(libItem({ id: Number(params.id), ...body, notes: JSON.stringify(body.notes ?? []) })))
    }),
    http.put('*/api/v1/library/items/:id/tags', async ({ request, params }) => {
      const body = (await request.json()) as { tags: string[] }
      calls.put.push(body)
      if (o.putTags) return o.putTags(body)
      return HttpResponse.json(envelope({ id: Number(params.id), tags: JSON.stringify(body.tags) }))
    }),
    http.delete('*/api/v1/library/items/:id', ({ params }) => {
      calls.deleted.push(String(params.id))
      return HttpResponse.json(envelope(null))
    }),
  )
  return calls
}

describe('My Library', () => {
  it('lists saved items with counts and codes, and opens one in the detail pane', async () => {
    mockMe()
    mockLibrary()
    renderApp('/library', { signedIn: true })

    expect(await screen.findByRole('heading', { name: 'My Library' })).toBeInTheDocument()
    expect(await screen.findByText(/3 saved · 1 favourites · 2 collections/)).toBeInTheDocument()

    const row = await screen.findByRole('button', { name: /Sahih Muslim #1907/ })
    expect(within(row).getByText('REP-001907')).toBeInTheDocument()

    await userEvent.click(await screen.findByRole('button', { name: /Bad’ al-Wahy/ }))
    const detail = await screen.findByRole('article')
    expect(within(detail).getByText('Vol. 1, Book 1, Hadith 1')).toBeInTheDocument()
    expect(within(detail).getByText(MATN)).toBeInTheDocument()
    expect(within(detail).getByText(/Private · My Library/)).toBeInTheDocument()
    // Which projects use it is not known to the API: say so instead of showing "none".
    expect(within(detail).getByText(/Which projects use this item isn't shown yet/)).toBeInTheDocument()
  })

  it('shows the first-run empty state for a library with nothing in it', async () => {
    mockMe()
    mockLibrary({ items: [] })
    renderApp('/library', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'Your library is empty' })).toBeInTheDocument()
    expect(screen.getByText(/Saving here never changes the corpus/)).toBeInTheDocument()
  })

  it('says a link to an item that is not yours is not available, without saying why', async () => {
    mockMe()
    mockLibrary()
    renderApp('/library?item=999', { signedIn: true })
    expect(await screen.findByRole('heading', { name: "That library item isn't available" })).toBeInTheDocument()
    // The researcher's own library still shows underneath.
    expect(await screen.findByRole('button', { name: /Sahih Muslim #1907/ })).toBeInTheDocument()
  })

  it('shows a list error with a retry and keeps the page frame', async () => {
    mockMe()
    server.use(
      http.get('*/api/v1/library/items', () => HttpResponse.json({ success: false, error: { message: 'boom' } }, { status: 500 })),
      http.get('*/api/v1/library/collections', () => HttpResponse.json(envelope([]))),
      http.get('*/api/v1/library/tags', () => HttpResponse.json(envelope([]))),
    )
    renderApp('/library', { signedIn: true })
    expect(await screen.findByRole('heading', { name: "Your library couldn't be loaded" })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('sends the chosen filters to the API', async () => {
    mockMe()
    const calls = mockLibrary()
    renderApp('/library', { signedIn: true })
    await screen.findByRole('button', { name: /Sahih Muslim #1907/ })

    await userEvent.click(screen.getByRole('button', { name: /Favourites/ }))
    await waitFor(() => expect(calls.lists.some((p) => p.get('is_favourite') === 'true')).toBe(true))

    await userEvent.click(screen.getByRole('button', { name: /Chains/ }))
    await waitFor(() => expect(calls.lists.some((p) => p.get('collection_id') === '1')).toBe(true))
  })

  it('marks a record that was merged in the corpus and keeps the snapshot', async () => {
    mockMe()
    mockLibrary({ items: [libItem({ source_status: 'merged', merged_into: 'REP-TIR-000044b' })] })
    renderApp('/library?item=4', { signedIn: true })
    const detail = await screen.findByRole('article')
    expect(within(detail).getByText('Source changed · merged')).toBeInTheDocument()
    expect(within(detail).getByText(/REP-TIR-000044b/)).toBeInTheDocument()
    expect(within(detail).getByText(MATN)).toBeInTheDocument()
  })

  it('lists incomplete-citation flags as neutral states, in words', async () => {
    mockMe()
    mockLibrary({ items: [libItem({ incomplete_citation_flags: '["no_page"]' })] })
    renderApp('/library?item=4', { signedIn: true })
    const detail = await screen.findByRole('article')
    expect(within(detail).getByText('Page missing')).toBeInTheDocument()
  })

  it('adds a tag and shows it when the server kept it', async () => {
    mockMe()
    const calls = mockLibrary()
    renderApp('/library?item=4', { signedIn: true })
    const detail = await screen.findByRole('article')
    await userEvent.type(within(detail).getByLabelText('Tag'), 'kufan')
    await userEvent.click(within(detail).getByRole('button', { name: 'Add tag' }))
    await waitFor(() => expect(calls.put).toEqual([{ tags: ['kufan'] }]))
  })

  it('does not claim a tag was saved when the server ignored it (C-13)', async () => {
    mockMe()
    mockLibrary({ putTags: () => HttpResponse.json(envelope({ id: 4, tags: '[]' })) })
    renderApp('/library?item=4', { signedIn: true })
    const detail = await screen.findByRole('article')
    await userEvent.type(within(detail).getByLabelText('Tag'), 'kufan')
    await userEvent.click(within(detail).getByRole('button', { name: 'Add tag' }))
    expect(await within(detail).findByText(/did not keep your tags/)).toBeInTheDocument()
    expect(within(detail).queryByText('#kufan')).not.toBeInTheDocument()
  })

  it('toggles the favourite and reports it when the server did not keep it', async () => {
    mockMe()
    const calls = mockLibrary({ patch: () => HttpResponse.json(envelope(libItem({ is_favourite: false }))) })
    renderApp('/library?item=4', { signedIn: true })
    const detail = await screen.findByRole('article')
    await userEvent.click(within(detail).getByRole('button', { name: /Favourite/ }))
    expect(await within(detail).findByText(/did not keep your favourite mark/)).toBeInTheDocument()
    expect(calls.patch).toEqual([{ is_favourite: true }])
  })

  it('adds a private note', async () => {
    mockMe()
    const calls = mockLibrary()
    renderApp('/library?item=4', { signedIn: true })
    const detail = await screen.findByRole('article')
    await userEvent.click(within(detail).getByRole('button', { name: '+ Add note' }))
    await userEvent.type(within(detail).getByLabelText('A note only you can see'), 'Check the Kufan variant')
    await userEvent.click(within(detail).getByRole('button', { name: 'Save note' }))
    await waitFor(() => expect(calls.patch).toHaveLength(1))
    expect((calls.patch[0]!.notes as { text: string }[])[0]!.text).toBe('Check the Kufan variant')
  })

  it('removes an item only after confirmation, and says what stays', async () => {
    mockMe()
    const calls = mockLibrary()
    renderApp('/library?item=4', { signedIn: true })
    const detail = await screen.findByRole('article')
    await userEvent.click(within(detail).getByRole('button', { name: 'Remove from My Library' }))
    const dialog = await screen.findByRole('dialog')
    expect(calls.deleted).toEqual([])
    expect(within(dialog).getByText(/corpus source and any project that already uses it stay as they are/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove from My Library' }))
    await waitFor(() => expect(calls.deleted).toEqual(['4']))
  })

  it('previews what will be shared, then reports each project separately', async () => {
    mockMe()
    mockLibrary({ items: [libItem({ tags: '["canonical"]' })] })
    let addBody: Record<string, unknown> | null = null
    server.use(
      http.get('*/api/v1/projects', ({ request }) => {
        const scope = new URL(request.url).searchParams.get('scope')
        const rows = scope === 'owned' ? [project({ id: 12, title: 'Chains of the wuḍūʾ reports' }), project({ id: 13, title: 'Sorani reading guide' })] : []
        return HttpResponse.json(envelope(rows, { ...pg(rows.length), counts: { owned: rows.length, shared: 0, archived: 0, trash: 0 } }))
      }),
      http.post('*/api/v1/library/items/4/share-preview', () =>
        HttpResponse.json(
          envelope([{ project_id: 12, project_title: 'Chains of the wuḍūʾ reports', already_in_project: false, will_include: { resource: true, locator: true, excerpt: false, tags: true, notes: false } }]),
        ),
      ),
      http.post('*/api/v1/library/items/4/add-to-projects', async ({ request }) => {
        addBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(
          envelope([
            { project_id: 12, status: 'added', project_resource_id: 1 },
            { project_id: 13, status: 'forbidden' },
          ]),
        )
      }),
    )
    renderApp('/library?item=4', { signedIn: true })
    const detail = await screen.findByRole('article')
    await userEvent.click(within(detail).getByRole('button', { name: 'Add to project…' }))
    const dialog = await screen.findByRole('dialog', { name: /Add to project/ })

    await userEvent.click(await within(dialog).findByRole('checkbox', { name: /Chains of the wuḍūʾ reports/ }))
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Sorani reading guide/ }))
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /My tags/ }))
    expect(within(dialog).getByText('#canonical')).toBeInTheDocument()
    expect(within(dialog).getByText(/Not shared: .*Saved excerpt/)).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Add to 2 projects' }))
    expect(await within(dialog).findByText('Added to 1 of 2 projects')).toBeInTheDocument()
    expect(within(dialog).getByText(/Chains of the wuḍūʾ reports: added\./)).toBeInTheDocument()
    expect(within(dialog).getByText(/Sorani reading guide: not added/)).toBeInTheDocument()
    expect(addBody).toEqual({ project_ids: [12, 13], share: { excerpt: false, tags: true, notes: false } })
  })
})

describe('Project resources', () => {
  const resource = (over: Record<string, unknown> = {}) => ({
    id: 24,
    resource_type: 'corpus_hadith',
    corpus_table: 'hadiths',
    corpus_id: 1,
    title: 'Sahih al-Bukhari #1 — Bad’ al-Wahy',
    author: 'al-Bukhārī',
    source_metadata: { locator: 'Vol. 1, Book 1, Hadith 1' },
    pivot: {
      project_id: 12,
      resource_id: 24,
      added_by: 1,
      inclusion_rationale: 'Baseline canonical recension.',
      tags: '["Canonical", "Baseline"]',
      created_at: '2026-10-04T18:46:11Z',
    },
    ...over,
  })

  function mockResources(rows: unknown[], extra: { role?: string } = {}) {
    const removed: string[] = []
    mockProjectApis(12, {
      detail: projectDetail({
        memberships: [{ user_id: 1, role: extra.role ?? 'owner', status: 'accepted', user: { id: 1, display_name: 'Shilan Rashid' } }],
        ...(extra.role && extra.role !== 'owner' ? { owner_id: 2 } : {}),
      }),
    })
    server.use(
      http.get('*/api/v1/projects/12/resources', () => HttpResponse.json(envelope(rows, pg(rows.length)))),
      http.get('*/api/v1/projects/12/resource-collections', () => HttpResponse.json(envelope([{ id: 1, name: 'Kufan', items_count: 2 }]))),
      http.get('*/api/v1/library/items', () => HttpResponse.json(envelope([libItem({ resource_id: 24 })], pg(1)))),
      http.delete('*/api/v1/projects/12/resources/:rid', ({ params }) => {
        removed.push(String(params.rid))
        return HttpResponse.json(envelope(null))
      }),
    )
    return removed
  }

  it('lists this project’s resources with their project-only tags', async () => {
    mockMe()
    mockResources([resource()])
    renderApp('/projects/12/resources', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'Resources' })).toBeInTheDocument()
    expect(await screen.findByText('1 resource · 1 collection')).toBeInTheDocument()
    const row = await screen.findByRole('button', { name: /Bad’ al-Wahy/ })
    expect(within(row).getByText('#Canonical #Baseline')).toBeInTheDocument()
    expect(screen.getByText('🔒 My Library is separate')).toBeInTheDocument()
    expect(screen.getByText('Kufan')).toBeInTheDocument()
  })

  it('shows the empty state with both ways to add', async () => {
    mockMe()
    mockResources([])
    renderApp('/projects/12/resources', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'No resources in this project yet' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Add from My Library…' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Add resource' }).length).toBeGreaterThan(0)
  })

  it('shows the resource detail: reason, origin date, and what is not known', async () => {
    mockMe()
    mockResources([resource()])
    renderApp('/projects/12/resources?resource=24', { signedIn: true })
    const detail = await screen.findByRole('article')
    expect(within(detail).getByText('Baseline canonical recension.')).toBeInTheDocument()
    expect(within(detail).getByText(/Points to corpus record REP-000001/)).toBeInTheDocument()
    expect(within(detail).getByText('Not counted yet')).toBeInTheDocument()
    expect(await within(detail).findByText('Also in your library')).toBeInTheDocument()
  })

  it('treats a resource id from another project as not available', async () => {
    mockMe()
    mockResources([resource()])
    renderApp('/projects/12/resources?resource=999', { signedIn: true })
    expect(await screen.findByRole('heading', { name: "That resource isn't available" })).toBeInTheDocument()
  })

  it('removes a resource only after confirmation', async () => {
    mockMe()
    const removed = mockResources([resource()])
    renderApp('/projects/12/resources?resource=24', { signedIn: true })
    const detail = await screen.findByRole('article')
    await userEvent.click(within(detail).getByRole('button', { name: 'Remove from this project…' }))
    const dialog = await screen.findByRole('dialog')
    expect(removed).toEqual([])
    expect(within(dialog).getByText(/Your My Library entry and other projects are not affected/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: /^Remove from PRJ-0012$/ }))
    await waitFor(() => expect(removed).toEqual(['24']))
  })

it('adds chosen library items to the project, leaving out what is already there', async () => {
    mockMe()
    mockResources([resource()])
    const attached: Record<string, unknown>[] = []
    server.use(
      http.get('*/api/v1/library/items', () =>
        HttpResponse.json(
          envelope(
            [libItem({ id: 4, resource_id: 24 }), libItem({ id: 5, resource_id: 89, resource: { ...libItem().resource, id: 89, title: 'Sahih Muslim #1907', corpus_id: 1907 } })],
            pg(2),
          ),
        ),
      ),
      http.post('*/api/v1/projects/12/resources', async ({ request }) => {
        attached.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json(envelope(null), { status: 201 })
      }),
    )
    renderApp('/projects/12/resources', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Add from My Library…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add from My Library' })
    // Bukhari #1 is already in the project, so only Muslim is offered.
    expect(await within(dialog).findByRole('checkbox', { name: /Sahih Muslim #1907/ })).toBeInTheDocument()
    expect(within(dialog).queryByRole('checkbox', { name: /Bad’ al-Wahy/ })).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('checkbox', { name: /Sahih Muslim #1907/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add 1 source' }))
    await waitFor(() => expect(attached).toEqual([{ resource_id: 89 }]))
  })

  it('gives a viewer the list but no way to add or remove', async () => {
    mockMe()
    mockResources([resource()], { role: 'viewer' })
    renderApp('/projects/12/resources?resource=24', { signedIn: true })
    const detail = await screen.findByRole('article')
    expect(within(detail).queryByRole('button', { name: /Remove from this project/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Add resource' })).not.toBeInTheDocument()
  })
})
