import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { envelope, renderApp } from '@/test/helpers'
import { server } from '@/test/server'

const pg = (n: number, perPage = 12) => ({ pagination: { current_page: 1, per_page: perPage, total_items: n, total_pages: Math.max(1, Math.ceil(n / perPage)), has_more: n > perPage } })

const pub = (over: Record<string, unknown> = {}) => ({
  id: 3,
  public_slug: 'kufan-routes',
  doi: '10.5281/openhadith.7.1759999999',
  title: 'Kufan chains of the wuḍūʾ reports',
  abstract: 'Of 14 occurrences, 11 preserve only the threefold wording.',
  version_string: '1.0.0',
  license: 'CC-BY-4.0',
  status: 'published',
  retraction_reason: null,
  retracted_at: null,
  released_at: '2026-10-12T10:00:00Z',
  corrigenda: [],
  project: { id: 12, title: 'Chains', scope: 'Six Sunan collections', stage: 'writing', owner: { id: 2, display_name: 'Shilan Rashid', affiliation: 'Soran University' } },
  submission: { id: 7, version_number: 2, reviews: [{ id: 1, reviewer_alias: 'Reviewer 1', recommendation: 'approve', review_comments: 'SECRET REVIEW COMMENT', submitted_at: '2026-10-04T10:00:00Z' }, { id: 2, submitted_at: null }], decision: { editorial_notes: 'SECRET EDITOR NOTE' } },
  releaser: { id: 9, display_name: 'Karwan Aziz' },
  published_content: {
    abstract: 'Of 14 occurrences…',
    project: { id: 12, title: 'SECRET PROJECT' },
    documents: [{ id: 3, title: 'Main article', latest_version: { content: '# Introduction\n\nThe Kufan routes share a common link.', author_id: 2 } }],
    findings: [{ id: 4, claim: 'The expansion is a later development.', reasoning: 'Only on the Wakīʿ route.', limitations: null, status: 'provisional', evidence_items: [{ id: 9, collector_id: 2 }] }],
  },
  ...over,
})

function mockPublic(items: Record<string, unknown>[] = [pub(), pub({ id: 4, public_slug: 'second', title: 'A second study', doi: '10.1234/abc.5', abstract: 'A short one.', submission: { reviews: [] } })], cite?: () => Response | undefined) {
  const calls = { queries: [] as URLSearchParams[], cites: [] as string[], headers: [] as (string | null)[] }
  server.use(
    http.get('*/api/v1/public/research', ({ request }) => {
      calls.queries.push(new URL(request.url).searchParams)
      calls.headers.push(request.headers.get('authorization'))
      return HttpResponse.json(envelope(items, pg(items.length)))
    }),
    http.get('*/api/v1/public/research/:slug/cite', ({ request }) => {
      const format = new URL(request.url).searchParams.get('format') ?? ''
      calls.cites.push(format)
      return cite?.() ?? HttpResponse.json(envelope({ format, citation: `${format.toUpperCase()} CITATION TEXT`, doi: '10.1234/abc.5' }))
    }),
    http.get('*/api/v1/public/research/:slug', ({ params }) => {
      const found = items.find((i) => i.public_slug === params.slug)
      return found ? HttpResponse.json(envelope(found)) : HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Publication not found.' } }, { status: 404 })
    }),
  )
  return calls
}

describe('Published research list', () => {
  it('lists released publications for someone who is not signed in, with no credentials, a reviewed tag only where reviews are finished', async () => {
    const calls = mockPublic()
    renderApp('/research')
    const list = await screen.findByRole('list', { name: 'Published research' })
    const first = within(list).getAllByRole('listitem')[0]!
    expect(within(first).getByRole('link', { name: 'Kufan chains of the wuḍūʾ reports' })).toHaveAttribute('href', '/research/kufan-routes')
    expect(within(first).getByText('Reviewed')).toBeInTheDocument()
    expect(within(within(list).getAllByRole('listitem')[1]!).queryByText('Reviewed')).not.toBeInTheDocument()
    expect(within(first).getByText(/Shilan Rashid/)).toBeInTheDocument()
    expect(calls.headers[0]).toBeNull()
  })

  it('never renders a reviewer, an editor’s note or a project’s title', async () => {
    mockPublic()
    renderApp('/research')
    await screen.findByRole('list', { name: 'Published research' })
    expect(document.body.textContent).not.toMatch(/SECRET|Reviewer 1|Karwan Aziz/)
  })

  it('searches and filters on the server, with both in the address', async () => {
    const calls = mockPublic()
    const { router } = renderApp('/research')
    await screen.findByRole('list', { name: 'Published research' })
    await userEvent.type(screen.getByRole('searchbox'), 'wudu{Enter}')
    await userEvent.selectOptions(screen.getByLabelText('Show'), 'Retracted')
    await waitFor(() => {
      const q = calls.queries.at(-1)!
      expect(q.get('q')).toBe('wudu')
      expect(q.get('status')).toBe('retracted')
    })
    expect(router.state.location.search).toBe('?q=wudu&status=retracted')
  })

  it('says there is nothing, and when the search finds nothing, and shows an error with a retry', async () => {
    mockPublic([])
    const view = renderApp('/research')
    expect(await screen.findByText('Nothing has been published yet')).toBeInTheDocument()
    await userEvent.type(screen.getByRole('searchbox'), 'zzz{Enter}')
    expect(await screen.findByText(/No published research matches/)).toBeInTheDocument()
    view.unmount()
    server.use(http.get('*/api/v1/public/research', () => HttpResponse.json({ success: false, error: { code: 'ERROR', message: 'x' } }, { status: 500 })))
    renderApp('/research')
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

describe('Publication page', () => {
  it('shows the text, the findings with limitations or a plain none, and what was released', async () => {
    mockPublic()
    renderApp('/research/kufan-routes')
    expect(await screen.findByRole('heading', { level: 1, name: 'Kufan chains of the wuḍūʾ reports' })).toBeInTheDocument()
    expect(screen.getByText('The Kufan routes share a common link.')).toBeInTheDocument()
    expect(screen.getByText('The expansion is a later development.')).toBeInTheDocument()
    expect(screen.getByText('No limitations written.')).toBeInTheDocument()
    const about = screen.getByRole('region', { name: 'About this publication' })
    expect(within(about).getByText('CC-BY-4.0')).toBeInTheDocument()
    expect(within(about).getByText('1.0.0')).toBeInTheDocument()
    expect(within(about).getByText('1 review finished')).toBeInTheDocument()
  })

  it('says only how many reviews were finished, and never names a reviewer, an editor, the releaser or the project’s internals', async () => {
    mockPublic()
    renderApp('/research/kufan-routes')
    await screen.findByRole('heading', { level: 1, name: 'Kufan chains of the wuḍūʾ reports' })
    expect(document.body.textContent).not.toMatch(/SECRET|Reviewer 1|Karwan Aziz/)
    expect(document.querySelector('a[href*="/projects/"]')).toBeNull()
  })

  it('does not present the platform’s own identifier as a DOI, and links a real DOI', async () => {
    mockPublic()
    const first = renderApp('/research/kufan-routes')
    const about = await screen.findByRole('region', { name: 'About this publication' })
    expect(within(about).getByText('Platform identifier (not a DOI)')).toBeInTheDocument()
    expect(within(about).queryByRole('link', { name: /openhadith/ })).not.toBeInTheDocument()
    first.unmount()
    renderApp('/research/second')
    const second = await screen.findByRole('region', { name: 'About this publication' })
    expect(within(second).getByRole('link', { name: '10.1234/abc.5' })).toHaveAttribute('href', 'https://doi.org/10.1234/abc.5')
  })

  it('shows a correction above the text, with its notice and version', async () => {
    mockPublic([pub({ version_string: '1.0.1', corrigenda: [{ id: 1, notice: 'Fixed a citation in section 3.', new_version: '1.0.1', created_at: '2026-10-20T00:00:00Z' }] })])
    renderApp('/research/kufan-routes')
    const banner = await screen.findByRole('region', { name: 'Corrected · version 1.0.1' })
    expect(within(banner).getByText('Fixed a citation in section 3.')).toBeInTheDocument()
  })

  it('shows a retraction with its reason, and keeps the text, marked', async () => {
    mockPublic([pub({ status: 'retracted', retraction_reason: 'A source was misattributed.', retracted_at: '2026-12-02T00:00:00Z' })])
    renderApp('/research/kufan-routes')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('A source was misattributed.')
    expect(alert).toHaveTextContent(/kept for the record/)
    expect(screen.getByText('The Kufan routes share a common link.')).toBeInTheDocument()
  })

  it('looks the same for an address never released and one not yet released', async () => {
    mockPublic()
    renderApp('/research/nothing-here')
    expect(await screen.findByRole('heading', { name: 'Nothing has been published at this address' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse published research' })).toHaveAttribute('href', '/research')
  })
})

describe('Citation', () => {
  it('asks the server for the chosen format and copies what it answers', async () => {
    const calls = mockPublic()
    renderApp('/research/kufan-routes')
    const box = await screen.findByRole('region', { name: 'Cite this' })
    expect(await within(box).findByText('BIBTEX CITATION TEXT')).toBeInTheDocument()
    await userEvent.selectOptions(within(box).getByLabelText(/Format/), 'APA')
    expect(await within(box).findByText('APA CITATION TEXT')).toBeInTheDocument()
    expect(calls.cites).toEqual(['bibtex', 'apa'])
  })

  it('says so when the server answers in another format than asked, and never labels it as the asked one', async () => {
    mockPublic(undefined, () => HttpResponse.json(envelope({ format: 'bibtex', citation: '@article{x}', doi: null })))
    renderApp('/research/kufan-routes')
    const box = await screen.findByRole('region', { name: 'Cite this' })
    await within(box).findByText('@article{x}')
    await userEvent.selectOptions(within(box).getByLabelText(/Format/), 'RIS')
    expect(await within(box).findByText(/answered in BibTeX for this request/)).toBeInTheDocument()
  })

  it('shows an error with a retry when the citation cannot load, without hiding the page', async () => {
    mockPublic(undefined, () => HttpResponse.json({ success: false, error: { code: 'ERROR', message: 'x' } }, { status: 500 }))
    renderApp('/research/kufan-routes')
    const box = await screen.findByRole('region', { name: 'Cite this' })
    expect(await within(box).findByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })
})
