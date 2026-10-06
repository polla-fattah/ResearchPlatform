import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { envelope, mockMe, project, renderApp } from '@/test/helpers'
import { mockProjectApis, mockProjectList, projectDetail } from '@/test/projectMocks'
import { server } from '@/test/server'

const template = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  slug: `t-${id}`,
  title: `Template ${id}`,
  description: `About template ${id}`,
  default_question: 'Does the report have a common link?',
  recommended_stages: ['scoping', 'collecting'],
  default_tasks: [{ title: 'Collect the variants' }, { title: 'Map the chains' }],
  ...over,
})

function mockTemplates(items: Record<string, unknown>[] = [template(1), template(2, { title: 'Ilal investigation', default_tasks: [] })], opts: { fail?: boolean } = {}) {
  const calls = { instantiated: [] as { id: string; body: Record<string, unknown> }[] }
  mockProjectList({ owned: [project({ id: 3, title: 'Existing project' })] })
  mockProjectApis(77)
  server.use(
    http.get('*/api/v1/project-templates', () => (opts.fail ? HttpResponse.json({ message: 'x' }, { status: 500 }) : HttpResponse.json(envelope(items)))),
    http.post('*/api/v1/project-templates/:id/instantiate', async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.instantiated.push({ id: String(params.id), body })
      return HttpResponse.json(envelope(projectDetail({ id: 77, title: body.title, question: body.custom_question })), { status: 201 })
    }),
  )
  return calls
}

const open = (qs = '') => renderApp(`/projects/templates${qs}`, { signedIn: true })

describe('Project templates', () => {
  it('lists the server’s templates with their starting tasks and says what a template adds', async () => {
    mockMe()
    mockTemplates()
    open()
    const list = await screen.findByRole('list', { name: 'Templates' })
    expect(within(list).getByText('Template 1')).toBeInTheDocument()
    expect(within(list).getByText('2 starting tasks')).toBeInTheDocument()
    expect(within(list).getAllByText('Suggested stages: scoping, collecting').length).toBeGreaterThan(0)
    expect(screen.getByText(/adds no evidence, gradings or conclusions/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start a blank project' })).toHaveAttribute('href', '/projects/new')
  })

  it('says so when the server has no templates', async () => {
    mockMe()
    mockTemplates([])
    open()
    expect(await screen.findByRole('heading', { name: 'No templates are published' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start a blank project' })).toBeInTheDocument()
  })

  it('shows an error with a retry when the templates cannot be loaded, and keeps the blank project available', async () => {
    mockMe()
    mockTemplates([], { fail: true })
    open()
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start a blank project' })).toBeInTheDocument()
  })

  it('does not offer a template with an untitled task, which would crash the server', async () => {
    mockMe()
    mockTemplates([template(1, { default_tasks: [{ title: 'A' }, {}] })])
    open()
    expect(await screen.findByText(/one of its starting tasks has no title/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Use the template/ })).not.toBeInTheDocument()
  })

  it('opens the form for a chosen template with its question and the tasks that will be created', async () => {
    mockMe()
    mockTemplates()
    const user = userEvent.setup()
    open()
    await user.click(await screen.findByRole('button', { name: 'Use the template Template 1' }))
    const form = await screen.findByRole('form', { name: 'New project from Template 1' })
    expect((within(form).getByLabelText(/^Research question/) as HTMLTextAreaElement).value).toBe('Does the report have a common link?')
    expect(within(form).getByRole('list', { name: 'Tasks that will be created' })).toHaveTextContent('Map the chains')
  })

  it('refuses an empty or already used title before asking the server', async () => {
    mockMe()
    const calls = mockTemplates()
    const user = userEvent.setup()
    open('?template=1')
    const form = await screen.findByRole('form', { name: 'New project from Template 1' })
    await user.click(within(form).getByRole('button', { name: 'Create private project' }))
    expect(await within(form).findByText('Give the project a title.')).toBeInTheDocument()
    await user.type(within(form).getByLabelText(/^Project title/), ' existing project ')
    await waitFor(() => expect(within(form).queryByText(/You already have a project with this title \(PRJ-0003\)/)).toBeInTheDocument())
    await user.click(within(form).getByRole('button', { name: 'Create private project' }))
    expect(calls.instantiated).toEqual([])
  })

  it('creates the project with the question and language chosen and goes to its overview', async () => {
    mockMe()
    const calls = mockTemplates()
    const user = userEvent.setup()
    const { router } = open('?template=1')
    const form = await screen.findByRole('form', { name: 'New project from Template 1' })
    await user.type(within(form).getByLabelText(/^Project title/), 'My takhrīj')
    await user.selectOptions(within(form).getByLabelText(/^Main language/), 'ckb')
    await user.click(within(form).getByRole('button', { name: 'Create private project' }))
    await waitFor(() => expect(calls.instantiated).toEqual([{ id: '1', body: { title: 'My takhrīj', custom_question: 'Does the report have a common link?', primary_language: 'ckb' } }]))
    await waitFor(() => expect(router.state.location.pathname).toBe('/projects/77/overview'))
  })

  it('reports a project the server created under another title instead of showing it as created', async () => {
    mockMe()
    mockTemplates()
    server.use(http.post('*/api/v1/project-templates/:id/instantiate', () => HttpResponse.json(envelope(projectDetail({ id: 77, title: 'Something else' })), { status: 201 })))
    const user = userEvent.setup()
    const { router } = open('?template=1')
    const form = await screen.findByRole('form', { name: 'New project from Template 1' })
    await user.type(within(form).getByLabelText(/^Project title/), 'My takhrīj')
    await user.click(within(form).getByRole('button', { name: 'Create private project' }))
    expect(await within(form).findByText(/The project was not created/)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/projects/templates')
  })

  it('says a template that is not on the server is not available', async () => {
    mockMe()
    mockTemplates()
    open('?template=999')
    expect(await screen.findByText('That template is not available.')).toBeInTheDocument()
  })

  it('is reachable from the new project page', async () => {
    mockMe()
    mockTemplates()
    renderApp('/projects/new', { signedIn: true })
    expect(await screen.findByRole('link', { name: 'Start from a template instead' })).toHaveAttribute('href', '/projects/templates')
  })
})
