import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { envelope, mockMe, renderApp } from '@/test/helpers'
import { server } from '@/test/server'

const BIB = `@book{hajar, title={Tahdhīb al-Tahdhīb}, author={Ibn Ḥajar}, year={1325}}
@article{ali, title={Wuḍūʾ studies}, author={Ali, M. and Kamal, A.}, journal={Journal}, year={2020}}
@misc{nameless, author={Nobody}}`

const item = (title: string) => ({ id: 1, resource_id: 1, tags: ['import'], resource: { id: 1, resource_type: 'external', title } })

function mockLibrary(over: { duplicate?: string; fail?: string } = {}) {
  const calls = { saved: [] as Record<string, unknown>[] }
  server.use(
    http.post('*/api/v1/library/items', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.saved.push(body)
      if (body.title === over.duplicate) return HttpResponse.json({ success: false, error: { code: 'DUPLICATE', message: 'dup', details: { existing_item: item(String(body.title)) } } }, { status: 409 })
      if (body.title === over.fail) return HttpResponse.json({ message: 'boom' }, { status: 500 })
      return HttpResponse.json(envelope(item(String(body.title))), { status: 201 })
    }),
  )
  return calls
}

async function paste(text: string) {
  const user = userEvent.setup({ delay: null })
  renderApp('/library/import', { signedIn: true })
  const box = await screen.findByLabelText(/^Or paste the references/)
  await user.click(box)
  await user.paste(text)
  return user
}

describe('Import references', () => {
  it('reads pasted BibTeX, lists each reference with its check, and leaves out the untitled one', async () => {
    mockMe()
    mockLibrary()
    await paste(BIB)
    expect(await screen.findByText('3 references found in the BibTeX file.')).toBeInTheDocument()
    const table = screen.getByRole('table')
    expect(within(table).getByText('Tahdhīb al-Tahdhīb')).toBeInTheDocument()
    expect(within(table).getByText('Has no title, so it is left out')).toBeInTheDocument()
    expect(within(table).getByRole('checkbox', { name: 'Import No title' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Import 2 references' })).toBeEnabled()
  })

  it('saves each kept reference to the library with a tag and the entry’s details, and reports the result', async () => {
    mockMe()
    const calls = mockLibrary()
    const user = await paste(BIB)
    await user.click(await screen.findByRole('button', { name: 'Import 2 references' }))
    expect(await screen.findByText('2 references saved to My Library.')).toBeInTheDocument()
    expect(calls.saved).toHaveLength(2)
    expect(calls.saved[0]).toMatchObject({ resource_type: 'external', title: 'Tahdhīb al-Tahdhīb', author: 'Ibn Ḥajar', tags: [expect.stringMatching(/^import \d{4}-\d{2}-\d{2}$/)], source_metadata: { cite_key: 'hajar', entry_type: 'book', year: '1325' } })
    expect(calls.saved[1]).toMatchObject({ author: 'Ali, M.; Kamal, A.' })
    expect(screen.getByRole('link', { name: 'Open My Library' })).toHaveAttribute('href', '/library')
  })

  it('does not import a reference the person switched off', async () => {
    mockMe()
    const calls = mockLibrary()
    const user = await paste(BIB)
    await user.click(await screen.findByRole('checkbox', { name: 'Import Wuḍūʾ studies' }))
    await user.click(screen.getByRole('button', { name: 'Import 1 reference' }))
    await screen.findByText('1 reference saved to My Library.')
    expect(calls.saved.map((s) => s.title)).toEqual(['Tahdhīb al-Tahdhīb'])
  })

  it('reports a reference already in the library as left alone, and one that failed, without stopping the rest', async () => {
    mockMe()
    const calls = mockLibrary({ duplicate: 'Tahdhīb al-Tahdhīb', fail: 'Wuḍūʾ studies' })
    const user = await paste(BIB.replace('@misc{nameless, author={Nobody}}', '@misc{c, title={Third}}'))
    await user.click(await screen.findByRole('button', { name: 'Import 3 references' }))
    expect(await screen.findByText('1 reference saved to My Library.')).toBeInTheDocument()
    expect(screen.getByText('1 was already in your library and was left as it is.')).toBeInTheDocument()
    expect(screen.getByText('1 could not be saved.')).toBeInTheDocument()
    const notSaved = screen.getByRole('list', { name: 'References that were not saved' })
    expect(within(notSaved).getByText(/already in your library/)).toBeInTheDocument()
    expect(calls.saved).toHaveLength(3)
  })

  it('reads RIS too', async () => {
    mockMe()
    mockLibrary()
    await paste('TY  - JOUR\nTI  - A RIS entry\nAU  - Ali, M.\nPY  - 2020\nER  - ')
    expect(await screen.findByText('1 reference found in the RIS file.')).toBeInTheDocument()
  })

  it('says what is wrong with a file that is neither, naming its first line', async () => {
    mockMe()
    mockLibrary()
    await paste('<?xml version="1.0"?><records/>')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('This can’t be read as BibTeX or RIS.')
    expect(alert).toHaveTextContent('<?xml version="1.0"?><records/>')
    expect(screen.queryByRole('button', { name: /^Import \d/ })).not.toBeInTheDocument()
  })

  it('refuses more references than can be imported at once', async () => {
    mockMe()
    mockLibrary()
    await paste(Array.from({ length: 201 }, (_, i) => `@misc{k${i}, title={T${i}}}`).join('\n'))
    expect(await screen.findByText(/201 references is more than the 200 that can be imported at once/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import 201 references' })).toBeDisabled()
  })

  it('says plainly that uploading files is not available', async () => {
    mockMe()
    mockLibrary()
    renderApp('/library/import', { signedIn: true })
    expect(await screen.findByText(/no way to receive files \(scans, articles, data\)/)).toBeInTheDocument()
  })

  it('is reachable from My Library', async () => {
    mockMe()
    server.use(
      http.get('*/api/v1/library/items', () => HttpResponse.json(envelope([], { pagination: { current_page: 1, per_page: 20, total_items: 0, total_pages: 1, has_more: false } }))),
      http.get('*/api/v1/library/collections', () => HttpResponse.json(envelope([]))),
      http.get('*/api/v1/library/tags', () => HttpResponse.json(envelope([]))),
    )
    renderApp('/library', { signedIn: true })
    expect(await screen.findByRole('link', { name: 'Import references' })).toHaveAttribute('href', '/library/import')
  })
})
