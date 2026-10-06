import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { envelope, mockMe, renderApp } from '@/test/helpers'
import { mockProjectApis, projectDetail } from '@/test/projectMocks'
import { server } from '@/test/server'

const MATN = 'أَنَّ النَّبِيَّ صلى الله عليه وسلم تَوَضَّأَ ثَلاَثًا ثَلاَثًا'

const occurrence = (over: Record<string, unknown> = {}) => ({
  id: 1060,
  book: { id: 5, title: 'Sunan Abī Dāwūd', edition: 'ed. al-Arnaʾūṭ', author: { id: 1, name: 'Abū Dāwūd' } },
  chapter: { id: 2, title: 'k. al-Ṭahāra' },
  hadith_number: 106,
  page_number: 78,
  volume: 1,
  edition: 'ed. al-Arnaʾūṭ (2009)',
  hukm: null,
  chain_summary: null,
  ...over,
})

const hit = (over: Record<string, unknown> = {}) => ({
  id: 318,
  full_hadith: null,
  matn: MATN,
  clean_matn: null,
  matched_mode: 'normalized',
  why: 'normalized',
  highlights: [],
  occurrences_count: 2,
  occurrences: [occurrence(), occurrence({ id: 1061, page_number: null, hadith_number: 84, book: { id: 6, title: 'Sunan al-Nasāʾī', edition: null, author: null } })],
  ...over,
})

const page = { pagination: { current_page: 1, per_page: 10, total_items: 1, total_pages: 1, has_more: false } }

interface Apis {
  hits?: unknown[]
  narrators?: unknown[]
  library?: unknown[]
  post?: (body: Record<string, unknown>) => Response | Promise<Response>
}

function mockPicker(o: Apis = {}) {
  const posted: Record<string, unknown>[] = []
  const attached: Record<string, unknown>[] = []
  server.use(
    http.get('*/api/v1/corpus/search', () => HttpResponse.json(envelope(o.hits ?? [hit()], page))),
    http.get('*/api/v1/corpus/narrators', () =>
      HttpResponse.json(envelope(o.narrators ?? [], { pagination: { current_page: 1, per_page: 10, total_items: (o.narrators ?? []).length, total_pages: 1, has_more: false } })),
    ),
    http.get('*/api/v1/library/items', () => HttpResponse.json(envelope(o.library ?? [], page))),
    http.post('*/api/v1/library/items', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      posted.push(body)
      if (o.post) return o.post(body)
      return HttpResponse.json(
        envelope({ id: 9, resource_id: 77, created_at: '2026-10-06T10:00:00Z', resource: { id: 77, resource_type: String(body.resource_type), title: String(body.title) } }),
        { status: 201 },
      )
    }),
    http.post('*/api/v1/projects/12/resources', async ({ request }) => {
      attached.push((await request.json()) as Record<string, unknown>)
      return HttpResponse.json(envelope(null), { status: 201 })
    }),
  )
  return { posted, attached }
}

const savedItem = (over: Record<string, unknown> = {}) => ({
  id: 4,
  resource_id: 88,
  locator: 'Sunan Abī Dāwūd · ed. al-Arnaʾūṭ (2009) · vol. 1, p. 78 · source no. 106',
  excerpt_text: null,
  created_at: '2026-09-20T10:00:00Z',
  resource: { id: 88, resource_type: 'hadith_reference', corpus_table: 'hadith_references', corpus_id: 1060, title: 'Sunan Abī Dāwūd, k. al-Ṭahāra, ḥadīth 106' },
  ...over,
})

async function open(path = '/library/add') {
  mockMe()
  const utils = renderApp(path, { signedIn: true })
  await screen.findByRole('heading', { name: 'Add resource' })
  return utils
}

const search = async (text: string) => {
  const user = userEvent.setup()
  await user.type(screen.getByRole('searchbox', { name: 'Search the corpus' }), text)
  return user
}

afterEach(() => vi.restoreAllMocks())

describe('Resource picker (07): from My Library', () => {
  it('opens from My Library with a corpus tab, an external tab, and searchable types only', async () => {
    mockPicker()
    await open()
    expect(screen.getByText('Opened from My Library')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'From the corpus', selected: true })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'External reference' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Narrator' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Book' })).toBeDisabled() // no book search in the API yet
    expect(screen.queryByLabelText(/project .* resources/i)).toBeNull() // only My Library from here
    expect(screen.getByText(/type at least two characters/i)).toBeInTheDocument()
  })

  it('finds a report with its occurrences, counted by unit, with locators', async () => {
    mockPicker()
    await open()
    await search('وضوء')
    expect(await screen.findByText('3 corpus items: 1 report record and 2 occurrences')).toBeInTheDocument()
    expect(screen.getByText('REP-000318')).toBeInTheDocument()
    expect(screen.getByText('2 occurrences in 2 books')).toBeInTheDocument()
    const row = screen.getByText('OCC-001060').closest('button')!
    expect(within(row).getByText('Sunan Abī Dāwūd, k. al-Ṭahāra, ḥadīth 106')).toBeInTheDocument()
    expect(within(row).getByText('Vol. 1 · p. 78')).toBeInTheDocument()
    const noPage = screen.getByText('OCC-001061').closest('button')!
    expect(within(noPage).getByText(/page unknown/)).toBeInTheDocument()
  })

  it('shows the source text, its provenance, and says occurrence wording is not recorded', async () => {
    mockPicker()
    await open()
    await search('وضوء')
    await userEvent.setup().click((await screen.findByText('OCC-001060')).closest('button')!)
    expect(screen.getByRole('heading', { name: 'Sunan Abī Dāwūd, k. al-Ṭahāra, ḥadīth 106' })).toBeInTheDocument()
    expect(screen.getByText('Source')).toBeInTheDocument()
    expect(screen.getByText('original text')).toBeInTheDocument()
    const text = screen.getByTestId('source-text')
    expect(text).toHaveTextContent(MATN) // exactly as stored
    expect(within(text).getByText(MATN)).toHaveAttribute('dir', 'rtl')
    expect(screen.getByText(/occurrence-specific wording is not recorded/i)).toBeInTheDocument()
    expect(screen.getByText(/vol\. 1 · p\. 78 · source no\. 106/)).toBeInTheDocument()
  })

  it('flags an unknown page instead of guessing it, and saves with the flag', async () => {
    const { posted } = mockPicker()
    await open()
    await search('وضوء')
    const user = userEvent.setup()
    await user.click((await screen.findByText('OCC-001061')).closest('button')!)
    expect(screen.getByText('Page: Unknown')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('heading', { name: 'Saved' })
    expect(posted[0]).toMatchObject({
      resource_type: 'hadith_reference',
      corpus_table: 'hadith_references',
      corpus_id: 1061,
      incomplete_citation_flags: ['page'],
    })
    expect(String(posted[0]!.locator)).toContain('page: Unknown')
  })

  it('saves the whole occurrence to My Library', async () => {
    const { posted, attached } = mockPicker()
    await open()
    await search('وضوء')
    const user = userEvent.setup()
    await user.click((await screen.findByText('OCC-001060')).closest('button')!)
    expect(screen.getByText('OCC-001060 → My Library')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('heading', { name: 'Saved' })).toBeInTheDocument()
    expect(screen.getByText(/was saved to my library\./i)).toBeInTheDocument()
    expect(posted).toHaveLength(1)
    expect(posted[0]).toMatchObject({ corpus_id: 1060, title: 'Sunan Abī Dāwūd, k. al-Ṭahāra, ḥadīth 106' })
    expect(posted[0]).not.toHaveProperty('allow_duplicate_excerpt')
    expect(attached).toHaveLength(0) // not a project save
  })

  it('saves a selected passage with its own text and locator', async () => {
    const { posted } = mockPicker()
    await open()
    await search('وضوء')
    const user = userEvent.setup()
    await user.click((await screen.findByText('OCC-001060')).closest('button')!)
    await user.click(screen.getByRole('radio', { name: /a selected passage/i }))
    expect(screen.getByText(/nothing selected yet/i)).toBeInTheDocument()

    const source = screen.getByTestId('source-text')
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'تَوَضَّأَ ثَلاَثًا', anchorNode: source } as unknown as Selection)
    fireEvent.mouseUp(source)
    expect(await screen.findByText('تَوَضَّأَ ثَلاَثًا', { selector: 'blockquote' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('heading', { name: 'Saved' })
    expect(posted[0]).toMatchObject({ excerpt_text: 'تَوَضَّأَ ثَلاَثًا' })
    expect(String(posted[0]!.locator)).toContain('selected passage')
  })

  it('saves a page range in the locator', async () => {
    const { posted } = mockPicker()
    await open()
    await search('وضوء')
    const user = userEvent.setup()
    await user.click((await screen.findByText('OCC-001060')).closest('button')!)
    await user.click(screen.getByRole('radio', { name: /^a page range/i }))
    await user.type(screen.getByLabelText('Pages'), '78–79')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('heading', { name: 'Saved' })
    expect(String(posted[0]!.locator)).toMatch(/pp\. 78–79$/)
  })

  it('finds narrators and saves one as an identity record', async () => {
    const { posted } = mockPicker({
      hits: [],
      narrators: [{ id: 4417, name: 'ʿAbd Allāh ibn Lahīʿa', kunya: 'Abū ʿAbd al-Raḥmān', laqab: null, deathdate: '174' }],
    })
    await open()
    await search('لهيعة')
    const user = userEvent.setup()
    await user.click((await screen.findByText('NAR-004417')).closest('button')!)
    expect(screen.getByText('Narrator identity NAR-004417')).toBeInTheDocument()
    expect(screen.getByText(/a narrator identity has no source text/i)).toBeInTheDocument()
    expect(screen.queryByText('What to save')).toBeNull() // identity records are saved whole
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('heading', { name: 'Saved' })
    expect(posted[0]).toMatchObject({ resource_type: 'corpus_narrator', corpus_table: 'narrators', corpus_id: 4417 })
  })

  it('opens a record directly from its code', async () => {
    let requested = ''
    mockPicker()
    server.use(
      http.get('*/api/v1/corpus/hadiths/:id', ({ params }) => {
        requested = String(params.id)
        return HttpResponse.json(
          envelope({ id: 318, matn: MATN, clean_matn: null, references: [{ id: 1060, hadith_id: 318, book_id: 5, hadith_number: 106, page_number: 78, book: { id: 5, title: 'Sunan Abī Dāwūd', edition: 'ed. al-Arnaʾūṭ' } }] }),
        )
      }),
    )
    await open()
    await search('REP-000318')
    expect(await screen.findByText('OCC-001060')).toBeInTheDocument()
    expect(requested).toBe('318')
  })
})

describe('Resource picker (07): duplicates (LIB-07)', () => {
  it('marks results already in My Library and asks what to do before saving again', async () => {
    const { posted } = mockPicker({ library: [savedItem()] })
    await open()
    await search('وضوء')
    const row = (await screen.findByText('OCC-001060')).closest('button')!
    expect(within(row).getByText('In My Library')).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(row)

    const prompt = screen.getByRole('group', { name: 'Already in My Library' })
    expect(within(prompt).getByText(/saved .* as “sunan abī dāwūd/i)).toBeInTheDocument()
    expect(within(prompt).getByText(/saving again won't duplicate it/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled() // a choice is needed first

    await user.click(within(prompt).getByRole('radio', { name: /reuse the existing entry/i }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(await screen.findByText(/nothing new was saved/i)).toBeInTheDocument()
    expect(posted).toHaveLength(0) // reuse never creates a second entry
  })

  it('needs a different page or span before a distinct excerpt can be saved, then allows the duplicate', async () => {
    const { posted } = mockPicker({ library: [savedItem()] })
    await open()
    await search('وضوء')
    const user = userEvent.setup()
    await user.click((await screen.findByText('OCC-001060')).closest('button')!)
    const prompt = screen.getByRole('group', { name: 'Already in My Library' })
    await user.click(within(prompt).getByRole('radio', { name: /save a distinct excerpt/i }))
    expect(within(prompt).getByText(/choose a selected passage or a page range below first/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()

    await user.click(screen.getByRole('radio', { name: /^a page range/i }))
    await user.type(screen.getByLabelText('Pages'), '80')
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('heading', { name: 'Saved' })
    expect(posted[0]).toMatchObject({ allow_duplicate_excerpt: true })
    expect(String(posted[0]!.locator)).toMatch(/pp\. 80$/)
  })

  it('learns about a duplicate from the server (409) when the library list did not show it', async () => {
    mockPicker({
      post: () =>
        HttpResponse.json(
          { success: false, error: { code: 'DUPLICATE', message: 'This resource is already saved in your library.', details: { existing_item: savedItem() } } },
          { status: 409 },
        ),
    })
    await open()
    await search('وضوء')
    const user = userEvent.setup()
    await user.click((await screen.findByText('OCC-001060')).closest('button')!)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('group', { name: 'Already in My Library' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Saved' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })
})

describe('Resource picker (07): search states', () => {
  it('keeps the query and offers a retry when the corpus search fails', async () => {
    mockPicker()
    server.use(http.get('*/api/v1/corpus/search', () => HttpResponse.error()))
    await open()
    await search('وضوء')
    expect(await screen.findByRole('heading', { name: /search didn't finish/i })).toBeInTheDocument()
    expect(screen.getByText(/your search “وضوء” is kept/i)).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search the corpus' })).toHaveValue('وضوء')

    mockPicker()
    await userEvent.setup().click(screen.getByRole('button', { name: /try again/i }))
    expect(await screen.findByText('REP-000318')).toBeInTheDocument()
  })

  it('says nothing matched and points to external references', async () => {
    mockPicker({ hits: [], narrators: [] })
    await open()
    await search('zzzz')
    expect(await screen.findByRole('heading', { name: 'No corpus items match “zzzz”' })).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add an external reference' }))
    expect(screen.getByRole('tab', { name: 'External reference', selected: true })).toBeInTheDocument()
  })

  it('keeps the selection and hides raw server text when saving fails', async () => {
    mockPicker({
      post: () =>
        HttpResponse.json({ message: 'SQLSTATE[23505]: Unique violation: duplicate key value violates unique constraint' }, { status: 500 }),
    })
    await open()
    await search('وضوء')
    const user = userEvent.setup()
    await user.click((await screen.findByText('OCC-001060')).closest('button')!)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(/your selection and entries are kept/i)).toBeInTheDocument()
    // A 500 can carry raw database text; people see a plain message instead.
    expect(screen.queryByText(/SQLSTATE|unique constraint/i)).toBeNull()
    expect(screen.getByText(/the server didn.t respond in time/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })
})

describe('Resource picker (07): external reference', () => {
  async function toExternal() {
    mockPicker()
    await open()
    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'External reference' }))
    return user
  }

  it('needs a title and nothing else', async () => {
    const user = await toExternal()
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
    expect(screen.getByText('A title is needed to save')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/^title/i), 'Early Egyptian transmission')
    expect(screen.getByRole('button', { name: 'Save with flag' })).toBeEnabled()
  })

  it('flags what is missing and never fills it in', async () => {
    const user = await toExternal()
    await user.type(screen.getByLabelText(/^title/i), 'Early Egyptian transmission')
    expect(screen.getByText('Incomplete citation')).toBeInTheDocument()
    expect(screen.getByText(/missing: author, publication date, publisher or journal, pages/i)).toBeInTheDocument()
    expect(screen.getByText(/\[Author unknown\]\. \(n\.d\.\)\. “Early Egyptian transmission”/)).toBeInTheDocument()
    expect(screen.getByText('Saves with an Incomplete citation flag (4 missing)')).toBeInTheDocument()
  })

  it('marks an unknown date as unknown and disables the field', async () => {
    const user = await toExternal()
    await user.type(screen.getByLabelText(/^title/i), 'Article')
    await user.click(screen.getByLabelText('Date unknown'))
    expect(screen.getByLabelText(/^publication date/i)).toBeDisabled()
    expect(screen.getByText(/publication date \(marked unknown\)/i)).toBeInTheDocument()
  })

  it('saves a complete reference without a flag, with its metadata', async () => {
    const { posted } = mockPicker()
    await open()
    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: 'External reference' }))
    await user.type(screen.getByLabelText(/^title/i), 'Encyclopedia of Canonical Ḥadīth')
    await user.type(screen.getByLabelText(/^author/i), 'Juynboll')
    await user.type(screen.getByLabelText(/^publication date/i), '2007')
    await user.type(screen.getByLabelText(/^published in/i), 'Brill')
    await user.type(screen.getByLabelText(/^pages/i), '1–40')
    expect(screen.getByText('All citation details are filled in.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save reference' }))
    await screen.findByRole('heading', { name: 'Saved' })
    expect(posted[0]).toMatchObject({
      resource_type: 'external',
      title: 'Encyclopedia of Canonical Ḥadīth',
      author: 'Juynboll',
      incomplete_citation_flags: [],
    })
    expect(posted[0]!.source_metadata).toMatchObject({ kind: 'article', date: '2007', venue: 'Brill', pages: '1–40' })
  })
})

describe('Resource picker (07): from a project', () => {
  async function openProject(detail?: Record<string, unknown>) {
    mockProjectApis(12, detail ? { detail } : {})
    const utils = await open('/projects/12/resources/add')
    await screen.findByText('Opened from Project PRJ-0012 · Resources')
    return utils
  }

  it('saves to My Library and adds the resource to the project', async () => {
    const { posted, attached } = mockPicker()
    await openProject()
    const user = userEvent.setup()
    expect(screen.getByRole('radio', { name: /project PRJ-0012 resources/i })).toBeChecked()
    await search('وضوء')
    await user.click((await screen.findByText('OCC-001060')).closest('button')!)
    expect(screen.getByText('OCC-001060 → Project PRJ-0012 resources')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText(/saved to my library and added to PRJ-0012 resources/i)).toBeInTheDocument()
    expect(posted).toHaveLength(1)
    expect(attached).toEqual([{ resource_id: 77 }])
    expect(screen.getByRole('link', { name: 'Open project resources' })).toHaveAttribute('href', '/projects/12/resources')
  })

  it('reuses an existing library entry and still adds it to the project', async () => {
    const { posted, attached } = mockPicker({ library: [savedItem()] })
    await openProject()
    await search('وضوء')
    const user = userEvent.setup()
    await user.click((await screen.findByText('OCC-001060')).closest('button')!)
    await user.click(screen.getByRole('radio', { name: /reuse the existing entry/i }))
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('heading', { name: 'Saved' })
    expect(posted).toHaveLength(0)
    expect(attached).toEqual([{ resource_id: 88 }])
  })

  it('explains why a read-only project cannot take resources and offers My Library', async () => {
    mockPicker()
    await openProject(projectDetail({ is_archived: true }))
    expect(screen.getByRole('heading', { name: /you can't add resources to this project right now/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /project PRJ-0012 resources/i })).toBeDisabled()
    expect(screen.getByRole('radio', { name: /^my library/i })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Save to My Library instead' })).toBeInTheDocument()
  })

  it('does not offer the project to a viewer', async () => {
    mockPicker()
    await openProject(
      projectDetail({
        owner_id: 99,
        memberships: [{ user_id: 1, role: 'viewer', status: 'accepted', user: { id: 1, display_name: 'Shilan' } }],
      }),
    )
    expect(screen.getByRole('radio', { name: /project PRJ-0012 resources/i })).toBeDisabled()
  })
})

describe('Resource picker (07): routes', () => {
  it('Close and Cancel go back to where the picker was opened', async () => {
    mockPicker()
    await open()
    expect(screen.getByRole('link', { name: 'Close' })).toHaveAttribute('href', '/library')
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/library')
  })

  it('is reachable from a project and goes back to its resources', async () => {
    mockPicker()
    mockProjectApis()
    await open('/projects/12/resources/add')
    await waitFor(() => expect(screen.getByRole('link', { name: 'Close' })).toHaveAttribute('href', '/projects/12/resources'))
  })
})
