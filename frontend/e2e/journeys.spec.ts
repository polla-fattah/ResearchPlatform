import { expect, test } from '@playwright/test'
import { installApi, USER } from './support/mockApi'

// Whole journeys through the built app, in a real browser: navigation, lazy page loading, forms, the keyboard. The API is
// answered by the in-memory mock, which keeps just enough state for each journey; it is a stand-in for the server and
// the contract tests (not these) say what the real server does.
const pg = (n: number) => ({ pagination: { current_page: 1, per_page: 20, total_items: n, total_pages: 1, has_more: false } })
const env = (data: unknown, extra: Record<string, unknown> = {}) => ({ success: true, message: 'Success', data, meta: { version: 'v1', ...extra } })

test('UC-01: a visitor signs in, and a wrong password says so and keeps the e-mail', async ({ page }) => {
  const logins: unknown[] = []
  await installApi(page, {
    extra: [
      [
        /^POST \/auth\/login$/,
        (_url, _m, body) => {
          logins.push(body)
          return (body as { password: string }).password === 'correct horse' ? { token: 'e2e-token', user: USER } : { status: 401, body: { message: 'These credentials do not match our records.' } }
        },
      ],
    ],
  })
  await page.goto('/home')
  await expect(page).toHaveURL(/\/sign-in/)

  await page.getByLabel(/^Email/).fill('shilan@example.org')
  await page.getByLabel(/^Password/).fill('wrong')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByLabel(/^Email/)).toHaveValue('shilan@example.org')

  await page.getByLabel(/^Password/).fill('correct horse')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: /welcome back, shilan rashid/i })).toBeVisible()
  expect(logins).toHaveLength(2)
  expect(await page.evaluate(() => sessionStorage.getItem('oh.token'))).toBe('e2e-token')
})

test('signing out leaves nothing of the person’s drafts in the browser and returns to sign-in', async ({ page }) => {
  await installApi(page, { signedIn: true, extra: [[/^POST \/auth\/logout$/, () => null]] })
  await page.addInitScript(() => localStorage.setItem('oh.draft.12.31', JSON.stringify({ text: 'private', baseVersion: 1, at: 1 })))
  await page.goto('/home')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/sign-in/)
  expect(await page.evaluate(() => [sessionStorage.getItem('oh.token'), localStorage.getItem('oh.draft.12.31')])).toEqual([null, null])
})

test('an invitation is read, accepted, and the project opens', async ({ page }) => {
  const accepted: string[] = []
  await installApi(page, {
    signedIn: true,
    extra: [
      [/^GET \/invitations\/tok$/, () => ({ token: 'tok', project_id: 12, project_title: 'Chains of the wuḍūʾ reports', inviter: 'Aras Kamal', role: 'researcher', status: 'pending', expires_at: '2099-01-01T00:00:00Z', is_expired: false })],
      [/^POST \/invitations\/tok\/accept$/, () => (accepted.push('tok'), { id: 1, role: 'researcher', status: 'accepted' })],
    ],
  })
  await page.goto('/invitations/tok')
  await expect(page.getByRole('heading', { level: 1, name: /Aras Kamal invited you to join a project/ })).toBeVisible()
  await page.getByRole('button', { name: 'Accept and open project' }).click()
  await expect(page).toHaveURL(/\/projects\/12\/overview/)
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  expect(accepted).toEqual(['tok'])
})

test('project to document: create one, and the editor (loaded on demand) opens with its text', async ({ page }) => {
  const created: Record<string, unknown>[] = []
  const doc = (body: Record<string, unknown>) => ({
    id: 77,
    project_id: 12,
    title: body.title,
    document_type: body.document_type ?? 'article',
    language: body.language ?? 'en',
    status: 'draft',
    latest_version: { id: 5, document_id: 77, version_number: 1, content: body.content ?? '', created_at: '2026-10-06T09:00:00Z', author: { id: 1, display_name: USER.display_name } },
    findings: [],
    created_at: '2026-10-06T09:00:00Z',
    updated_at: '2026-10-06T09:00:00Z',
  })
  let made: ReturnType<typeof doc> | null = null
  await installApi(page, {
    signedIn: true,
    extra: [
      [/^POST \/projects\/12\/documents$/, (_u, _m, body) => ((created.push(body as Record<string, unknown>), (made = doc(body as Record<string, unknown>))), { status: 201, body: env(made) })],
      [/^GET \/projects\/12\/documents\/77$/, () => made],
      [/^GET \/projects\/12\/documents\/77\/draft$/, () => ({ status: 404, body: { message: 'No draft' } })],
      [/^POST \/projects\/12\/documents\/77\/lock$/, () => ({ document_id: 77, locked_by: 1, locked_at: '2026-10-06T09:00:00Z', expires_at: '2099-01-01T00:00:00Z' })],
      [/^POST \/projects\/12\/documents\/77\/unlock$/, () => null],
      [/^PUT \/projects\/12\/documents\/77\/draft$/, () => ({ saved_at: '2026-10-06T09:01:00Z' })],
      [/^GET \/projects\/12\/documents\/77\/versions$/, () => ({ __list: made ? [made.latest_version] : [], extra: pg(1) })],
    ],
  })
  await page.goto('/projects/12/overview')
  await page.getByRole('link', { name: 'Findings & Documents' }).click()
  await page.getByRole('button', { name: 'New document' }).click()
  const dialog = page.getByRole('dialog', { name: 'New document' })
  await dialog.getByLabel(/Title/).fill('My study')
  await dialog.getByRole('button', { name: 'Create document' }).click()

  await expect(page).toHaveURL(/doc=77/)
  await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('heading', { name: 'My study' }).first()).toBeVisible()
  expect(created[0]).toMatchObject({ title: 'My study', document_type: 'article', content: '# My study\n\n' })

  // Typing in the editor works from the keyboard.
  await page.locator('.cm-content').click()
  await page.keyboard.type('First paragraph.')
  await expect(page.locator('.cm-content')).toContainText('First paragraph.')
})

test('export: preview what is included, start it, and the job appears with a download', async ({ page }) => {
  const started: unknown[] = []
  const job = { id: 41, scope: 'account', target_id: null, format: 'zip', status: 'completed', progress: 'Packaging completed', file_size: 143360, checksum: 'ab12', download_url: null, expires_at: new Date(Date.now() + 5 * 86_400_000).toISOString(), completed_at: null, created_at: new Date().toISOString(), failure_reason: null, parts: [{ id: 1, part_number: 1, name: 'export_41_part_1.zip', size: 143360, size_bytes: 143360, checksum: 'ab12', checksum_sha256: 'ab12', status: 'ready' }] }
  await installApi(page, {
    signedIn: true,
    extra: [
      [/^GET \/exports$/, () => ({ __list: started.length ? [job] : [], extra: pg(started.length) })],
      [/^GET \/exports\/quota$/, () => ({ used_bytes: 1000, limit_bytes: 5 * 1024 ** 3, concurrent_jobs: 0, concurrent_limit: 2 })],
      [/^POST \/exports\/preview$/, () => ({ counts: { projects: 1, resources: 8, evidence_items: 4, documents: 1 }, estimated_size_bytes: 143360, exclusions: [] })],
      [/^POST \/exports$/, (_u, _m, body) => ((started.push(body), { status: 201, body: env({ job_id: 41, export_job: job }) }))],
    ],
  })
  await page.goto('/downloads')
  await page.getByRole('button', { name: 'New export' }).first().click()
  await expect(page.getByText('Evidence items')).toBeVisible()
  await page.getByRole('button', { name: 'Start export' }).click()
  await expect(page.getByText(/Export EXP-0041 complete/)).toBeVisible()
  expect(started).toEqual([{ scope: 'account', formats: ['zip'] }])
  await expect(page.getByRole('button', { name: /Download part 1 EXP-0041/ })).toBeVisible()
})

test('a page that fails to load shows the plain error page inside the layout and offers a reload', async ({ page }) => {
  await installApi(page, { signedIn: true })
  await page.route('**/assets/DownloadsPage-*.js', (route) => route.abort())
  await page.goto('/home')
  await page.getByRole('link', { name: 'Downloads' }).first().click()
  await expect(page.getByRole('heading', { name: 'This page could not be loaded' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Account' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reload the page' })).toBeVisible()
  expect(await page.locator('body').innerText()).not.toMatch(/dynamically imported|\.js/)
})

test('admin approval: an administrator reads an application, approves it, and it leaves the waiting queue', async ({ page }) => {
  const decided: unknown[] = []
  const application = (status: string) => ({
    id: 417,
    user_id: 142,
    status,
    reference: 'APP-2026-0417',
    research_statement: 'Takhrīj of reports on ritual purity',
    decision_reason: null,
    decided_by: null,
    decided_at: null,
    created_at: '2026-10-02T14:11:00Z',
    information_request: null,
    user: { id: 142, display_name: 'Aras Kamal', email: 'aras@example.org', preferred_language: 'ckb', status: 'pending', is_admin: false, roles: ['applicant'], profile: { affiliation: null, biography: null, research_interests: ['Takhrīj'] } },
    replies: [],
  })
  await installApi(page, {
    signedIn: true,
    extra: [
      [/^GET \/auth\/me$/, () => ({ ...USER, is_admin: true, roles: ['admin'] })],
      [
        /^GET \/admin\/applications$/,
        (url) => {
          const status = url.searchParams.get('status') ?? 'pending'
          const waiting = decided.length === 0 && status === 'pending'
          return { __list: waiting ? [application('pending')] : [], extra: { pagination: { current_page: 1, per_page: 20, total_items: waiting ? 1 : 0, total_pages: 1, has_more: false } } }
        },
      ],
      [/^GET \/admin\/applications\/417$/, () => application('pending')],
      [/^POST \/admin\/applications\/417\/decide$/, (_u, _m, body) => (decided.push(body), { id: 417, status: 'approved' })],
    ],
  })
  await page.goto('/admin/applications')
  await expect(page.getByRole('heading', { level: 1, name: 'Applications' })).toBeVisible()
  await page.getByText('Aras Kamal').first().click()
  await expect(page.getByText('Takhrīj of reports on ritual purity').first()).toBeVisible()
  await page.getByRole('button', { name: 'Approve', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Approve', exact: true }).click()
  await expect(page.getByText(/Decision recorded: approved/)).toBeVisible()
  expect(decided).toEqual([{ decision: 'approved' }])
})
