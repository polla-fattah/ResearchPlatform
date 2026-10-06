import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mockMe, renderApp } from '@/test/helpers'
import { mockProjectApis } from '@/test/projectMocks'

describe('Datasets (not available)', () => {
  it('says the dataset builder is not available and offers no builder, only what exists now', async () => {
    mockMe()
    mockProjectApis(12)
    renderApp('/projects/12/datasets', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'Datasets are not available yet' })).toBeInTheDocument()
    expect(screen.getByText(/nothing can be built, saved or released/)).toBeInTheDocument()
    const page = within(screen.getByRole('main'))
    expect(page.queryByRole('button')).not.toBeInTheDocument()
    expect(page.getByRole('link', { name: 'Save a result set' })).toHaveAttribute('href', '/projects/12/searches')
    expect(page.getByRole('link', { name: 'Download your project data' })).toHaveAttribute('href', '/downloads')
  })

  it('shows the same plain page for any public dataset address, with a way to published research', async () => {
    renderApp('/datasets/wudu-three-times-v3')
    expect(await screen.findByRole('heading', { name: 'Nothing is published here' })).toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Published research' })).toHaveAttribute('href', '/research')
    expect(screen.queryByText(/wudu-three-times/)).not.toBeInTheDocument()
  })
})

describe('Rich-text editor (not available)', () => {
  it('says only the Markdown editor is offered and links back to the same document', async () => {
    mockMe()
    mockProjectApis(12)
    renderApp('/projects/12/documents/7/rich', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'Rich-text editing is not available yet' })).toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Open the document in the Markdown editor' })).toHaveAttribute('href', '/projects/12/findings?doc=7')
  })

  it('does not follow an address that is not a document number', async () => {
    mockMe()
    mockProjectApis(12)
    renderApp('/projects/12/documents/abc/rich', { signedIn: true })
    expect(await screen.findByRole('link', { name: 'Open the document in the Markdown editor' })).toHaveAttribute('href', '/projects/12/findings')
  })
})
