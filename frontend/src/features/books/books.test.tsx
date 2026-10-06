import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { envelope, mockMe, renderApp } from '@/test/helpers'
import { mockProjectApis } from '@/test/projectMocks'
import { server } from '@/test/server'

const pg = (n: number, per = 10) => ({ pagination: { current_page: 1, per_page: per, total_items: n, total_pages: Math.max(1, Math.ceil(n / per)), has_more: n > per } })

const structure = (chapters = [{ chapter_id: 5, chapter_title: 'بَابُ الْوُضُوءِ', chapter_number: 5, occurrence_count: 4 }, { chapter_id: 6, chapter_title: 'باب الصلاة', occurrence_count: 2 }, { chapter_id: 7, chapter_title: null, occurrence_count: 1 }]) => ({
  book_id: 3,
  book_title: 'Sunan Abī Dāwūd',
  author: { id: 1, name: 'Abū Dāwūd' },
  total_chapters: chapters.length,
  total_occurrences: chapters.reduce((a, c) => a + c.occurrence_count, 0),
  chapters,
})

function mockBooks(o: { chapters?: ReturnType<typeof structure>['chapters']; concordance?: Record<string, unknown> | Response; missing?: boolean; broken?: boolean } = {}) {
  const calls = { searches: [] as string[], concordances: [] as string[] }
  mockProjectApis(12)
  server.use(
    http.get('*/api/v1/corpus/books/3/structure', () => (o.broken ? HttpResponse.json({ message: 'x' }, { status: 500 }) : o.missing ? HttpResponse.json({ message: 'x' }, { status: 404 }) : HttpResponse.json(envelope(structure(o.chapters))))),
    http.get('*/api/v1/corpus/books', () => HttpResponse.json(envelope([{ id: 3, title: 'Sunan Abī Dāwūd', author: { id: 1, name: 'Abū Dāwūd' }, references_count: 5274 }], pg(1, 20)))),
    http.get('*/api/v1/corpus/search', ({ request }) => {
      calls.searches.push(new URL(request.url).search)
      return HttpResponse.json(envelope([{ id: 90, matn: 'تَوَضَّأَ ثَلاَثًا', clean_matn: 'توضا ثلاثا', occurrences: [{ id: 1, hadith_number: 135, chapter: { id: 5, title: 'x' } }] }], pg(1)))
    }),
    http.get('*/api/v1/corpus/concordance', ({ request }) => {
      calls.concordances.push(new URL(request.url).search)
      if (o.concordance instanceof Response) return o.concordance
      return HttpResponse.json(
        envelope(o.concordance ?? { search_term: 'ثلاثا', total_matches: 2, book_distribution: { 'Sunan Abī Dāwūd': 2 }, concordance_samples: [{ reference_id: 1, book_id: 3, book_title: 'Sunan Abī Dāwūd', chapter_title: 'بَابُ الْوُضُوءِ', number: 135, snippet: '...تَوَضَّأَ ثَلاثًا ثَلاثًا...' }, { reference_id: 2, book_id: 3, book_title: 'Sunan Abī Dāwūd', chapter_title: null, number: 7, snippet: 'something that does not have it...' }] }),
      )
    }),
  )
  return calls
}

describe('Book structure and terms', () => {
  it('lists the collections to choose from', async () => {
    mockMe()
    mockBooks()
    renderApp('/projects/12/analysis/books', { signedIn: true })
    const link = await screen.findByRole('link', { name: /Sunan Abī Dāwūd/ })
    expect(link).toHaveAttribute('href', '/projects/12/analysis/books/3')
    expect(link).toHaveTextContent('5,274 occurrences')
  })

  it('shows the chapters with their counts and says what is not available', async () => {
    mockMe()
    mockBooks()
    renderApp('/projects/12/analysis/books/3', { signedIn: true })
    expect(await screen.findByRole('heading', { level: 1, name: /Sunan Abī Dāwūd/ })).toBeInTheDocument()
    expect(screen.getByText(/critic-expression index/)).toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'Chapters' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    expect(within(list).getByText('#3')).toBeInTheDocument()
    expect(screen.getByText(/3 chapters · 7 occurrences/)).toBeInTheDocument()
  })

  it('filters chapters by title ignoring vowel marks', async () => {
    mockMe()
    mockBooks()
    const user = userEvent.setup()
    renderApp('/projects/12/analysis/books/3', { signedIn: true })
    await user.type(await screen.findByLabelText('Find a chapter by title'), 'الوضوء{Enter}')
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Chapters' })).getAllByRole('listitem')).toHaveLength(1))
  })

  it('opens a chapter from the address and lists its reports by book and chapter only', async () => {
    mockMe()
    const calls = mockBooks()
    renderApp('/projects/12/analysis/books/3?chapter=5', { signedIn: true })
    const article = await screen.findByRole('article')
    expect(await within(article).findByText('REP-000090')).toBeInTheDocument()
    expect(within(article).getByText(/No\. 135/)).toBeInTheDocument()
    expect(calls.searches[0]).toContain('book_id=3')
    expect(calls.searches[0]).toContain('chapter_id=5')
    expect(calls.searches[0]).not.toContain('q=')
  })

  it('says a chapter that is not in the book is not there', async () => {
    mockMe()
    mockBooks()
    renderApp('/projects/12/analysis/books/3?chapter=999', { signedIn: true })
    expect(await screen.findByText('That chapter is not in this book.')).toBeInTheDocument()
  })

  it('searches a word form, calls the counts "returned", and flags a snippet that is not in context', async () => {
    mockMe()
    const calls = mockBooks()
    renderApp('/projects/12/analysis/books/3?view=words&term=%D8%AB%D9%84%D8%A7%D8%AB%D8%A7', { signedIn: true })
    expect(await screen.findByText('2 places returned.')).toBeInTheDocument()
    expect(screen.getByText(/Counts only the places returned above/)).toBeInTheDocument()
    expect(screen.getAllByText(/not located in this text/)).toHaveLength(1)
    expect(calls.concordances[0]).toContain('limit=50')
    expect(calls.concordances[0]).not.toContain('book_id')
  })

  it('refuses a one-letter search before asking the server, and scopes to this book on request', async () => {
    mockMe()
    const calls = mockBooks()
    const user = userEvent.setup()
    renderApp('/projects/12/analysis/books/3?view=words', { signedIn: true })
    await user.type(await screen.findByRole('textbox', { name: /^Word form/ }), 'ث')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByText('Enter at least 2 characters.')).toBeInTheDocument()
    expect(calls.concordances).toEqual([])
    await user.type(screen.getByRole('textbox', { name: /^Word form/ }), 'ل')
    await user.click(screen.getByLabelText('This book only'))
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => expect(calls.concordances.at(-1)).toContain('book_id=3'))
  })

  it('says "at least" when the result reached the limit', async () => {
    mockMe()
    mockBooks({ concordance: { search_term: 'ab', total_matches: 50, book_distribution: { A: 50 }, concordance_samples: [] } })
    renderApp('/projects/12/analysis/books/3?view=words&term=ab', { signedIn: true })
    expect(await screen.findByText(/50 places returned, the most the server was asked for/)).toBeInTheDocument()
  })

  it('does not call no result a confirmed absence', async () => {
    mockMe()
    mockBooks({ concordance: { search_term: 'zz', total_matches: 0, book_distribution: {}, concordance_samples: [] } })
    renderApp('/projects/12/analysis/books/3?view=words&term=zz', { signedIn: true })
    expect(await screen.findByText(/not a confirmed absence/)).toBeInTheDocument()
  })

  it('shows an error with a retry when the structure cannot be loaded', async () => {
    mockMe()
    mockBooks({ broken: true })
    renderApp('/projects/12/analysis/books/3', { signedIn: true })
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('shows the not-available page for a collection that is not in the corpus', async () => {
    mockMe()
    mockBooks({ missing: true })
    renderApp('/projects/12/analysis/books/3', { signedIn: true })
    expect(await screen.findByText(/isn.t available|not available/i)).toBeInTheDocument()
  })
})
