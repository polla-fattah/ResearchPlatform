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
