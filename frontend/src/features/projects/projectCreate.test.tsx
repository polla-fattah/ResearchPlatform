import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { envelope, mockMe, project, renderApp } from '@/test/helpers'
import { mockProjectList, projectDetail } from '@/test/projectMocks'
import { server } from '@/test/server'

const open = async (existing = [project()]) => {
  mockMe()
  mockProjectList({ owned: existing })
  renderApp('/projects/new', { signedIn: true })
  await screen.findByRole('heading', { name: 'New project' })
  // Wait for the owned-projects lookup that powers the duplicate-title check.
  await waitFor(() => expect(screen.queryAllByRole('status', { name: 'Loading' })).toHaveLength(0))
}

async function fill(over: { title?: string; question?: string; scope?: string; languages?: string[]; tags?: string } = {}) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/^title/i), over.title ?? 'Women narrators in the Kufan wuḍūʾ chains')
  await user.type(screen.getByLabelText(/research question/i), over.question ?? 'Are there women in the Kufan chains?')
  await user.type(screen.getByLabelText(/^scope/i), over.scope ?? 'Six Sunan collections, third generation.')
  for (const l of over.languages ?? ['Arabic', 'Sorani']) await user.click(screen.getByLabelText(new RegExp(l, 'i')))
  if (over.tags) await user.type(screen.getByLabelText(/project tags/i), over.tags)
  return user
}

describe('Project creation (05)', () => {
  it('lists every missing field and keeps what was entered', async () => {
    await open()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/^title/i), 'Only a title')
    await user.click(screen.getByRole('button', { name: 'Create project' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/fix 3 fields to create the project/i)
    expect(alert).toHaveTextContent(/research question: write the question/i)
    expect(alert).toHaveTextContent(/scope: describe what is in and out/i)
    expect(alert).toHaveTextContent(/content language: choose at least one/i)
    expect(alert).toHaveTextContent(/everything else you entered is kept/i)
    expect(screen.getByLabelText(/^title/i)).toHaveValue('Only a title')
  })

  it('refuses a title you already use, naming the project it matches', async () => {
    await open([project({ id: 12, title: 'Chains of the wuḍūʾ reports' })])
    const user = await fill({ title: 'chains of the wuḍūʾ reports' }) // case-insensitive
    await user.click(screen.getByRole('button', { name: 'Create project' }))
    expect(await screen.findByText(/this matches PRJ-0012\. Titles must be unique/i, { selector: 'span' })).toBeInTheDocument()
  })

  it('creates the project with languages, tags and stage, then shows the next steps', async () => {
    let body: Record<string, unknown> | undefined
    server.use(
      http.post('*/api/v1/projects', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(
          envelope(projectDetail({ id: 18, title: 'Women narrators in the Kufan wuḍūʾ chains', stage: 'scoping' })),
          { status: 201 },
        )
      }),
    )
    await open()
    const user = await fill({ tags: 'wuḍūʾ, narrators ,' })
    await user.selectOptions(screen.getByLabelText(/starting stage/i), 'collecting')
    await user.click(screen.getByRole('button', { name: 'Create project' }))

    expect(await screen.findByText(/created · PRJ-0018/i)).toBeInTheDocument()
    expect(body).toMatchObject({
      title: 'Women narrators in the Kufan wuḍūʾ chains',
      question: 'Are there women in the Kufan chains?',
      scope: 'Six Sunan collections, third generation.',
      languages: ['ar', 'ckb'],
      primary_language: 'ar',
      stage: 'collecting',
      tags: ['wuḍūʾ', 'narrators'],
    })
    expect(screen.getByText('Private')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /add resources/i })).toHaveAttribute('href', '/projects/18/resources')
    expect(screen.getByRole('link', { name: /run a first search/i })).toHaveAttribute('href', '/projects/18/searches')
    expect(screen.getByRole('link', { name: /open overview/i })).toHaveAttribute('href', '/projects/18/overview')
    expect(screen.getByText('Private by default')).toBeInTheDocument()
    expect(screen.getByText('Separate from your other projects')).toBeInTheDocument()
  })

  it('explains why a pending or suspended account cannot create projects', async () => {
    server.use(
      http.post('*/api/v1/projects', () =>
        HttpResponse.json(
          { success: false, error: { code: 'ACCOUNT_NOT_APPROVED', message: 'Not approved.', details: [] } },
          { status: 403 },
        ),
      ),
    )
    await open()
    const user = await fill()
    await user.click(screen.getByRole('button', { name: 'Create project' }))
    expect(await screen.findByRole('heading', { name: /you can't create projects right now/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See account status' })).toHaveAttribute('href', '/status')
    expect(screen.getByRole('link', { name: 'Back to projects' })).toHaveAttribute('href', '/projects')
  })

  it('shows a plain error for a server failure and keeps the form', async () => {
    server.use(
      http.post('*/api/v1/projects', () =>
        HttpResponse.json({ success: false, error: { code: 'ERROR', message: 'Storage unavailable.', details: [] } }, { status: 500 }),
      ),
    )
    await open()
    const user = await fill()
    await user.click(screen.getByRole('button', { name: 'Create project' }))
    expect(await screen.findByText(/we couldn.t create the project/i)).toBeInTheDocument()
    expect(screen.queryByText('Storage unavailable.')).toBeNull() // 5xx text is never shown
    expect(screen.getByLabelText(/^title/i)).toHaveValue('Women narrators in the Kufan wuḍūʾ chains')
  })

  it('lets the question direction be set per field, with templates reserved for R2', async () => {
    await open()
    const user = userEvent.setup()
    const question = screen.getByLabelText(/research question/i)
    await user.type(question, 'هل في الأسانيد نساء؟')
    expect(question).toHaveAttribute('dir', 'rtl') // Auto follows the first strong character
    await user.click(screen.getByRole('button', { name: 'LTR' }))
    expect(question).toHaveAttribute('dir', 'ltr')
    expect(screen.getByRole('button', { name: 'LTR' })).toHaveAttribute('aria-pressed', 'true')

    expect(screen.getByLabelText(/blank project/i)).toBeChecked()
    expect(screen.getByLabelText(/takhrīj template · R2/i)).toBeDisabled()
  })
})
