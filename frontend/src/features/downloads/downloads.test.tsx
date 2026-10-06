import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ExportJob } from '@/api/schemas/exports'
import { envelope, mockMe, project, renderApp } from '@/test/helpers'
import { server } from '@/test/server'
import { daysUntil, jobState, splitBytes } from './downloadsModel'

const DAY = 86_400_000

const part = (over: Record<string, unknown> = {}) => ({
  id: 1,
  part_number: 1,
  name: 'export_40_part_1.zip',
  size: 640 * 1024 * 1024,
  size_bytes: 640 * 1024 * 1024,
  checksum: 'ab12cd34ef567890',
  checksum_sha256: 'ab12cd34ef567890',
  status: 'ready',
  ...over,
})

const job = (over: Record<string, unknown> = {}) => ({
  id: 40,
  scope: 'project',
  target_id: 12,
  format: 'zip',
  status: 'completed',
  progress: 'Packaging completed',
  file_size: 640 * 1024 * 1024,
  checksum: 'ab12',
  download_url: null,
  expires_at: new Date(Date.now() + 5 * DAY).toISOString(),
  completed_at: null,
  created_at: new Date(Date.now() - 3600_000).toISOString(),
  failure_reason: null,
  parts: [part()],
  ...over,
})

const pg = (n: number) => ({ pagination: { current_page: 1, per_page: 20, total_items: n, total_pages: 1, has_more: false } })
const quota = { used_bytes: 2.1 * 1024 ** 3, limit_bytes: 5 * 1024 ** 3, concurrent_jobs: 1, concurrent_limit: 2 }

interface Apis {
  jobs?: unknown[]
  listResponse?: Response
  quota?: Record<string, number>
  preview?: Record<string, unknown>
  create?: (body: Record<string, unknown>, key: string | null) => Response | undefined
  manifest?: Record<string, unknown> | Response
}

function mockExports(o: Apis = {}) {
  const calls = {
    created: [] as { body: Record<string, unknown>; key: string | null }[],
    previews: [] as Record<string, unknown>[],
    cancelled: [] as string[],
    downloads: [] as { path: string; auth: string | null }[],
  }
  const jobs = o.jobs ?? [job()]
  server.use(
    http.get('*/api/v1/exports', () => o.listResponse ?? HttpResponse.json(envelope(jobs, pg(jobs.length)))),
    http.get('*/api/v1/exports/quota', () => HttpResponse.json(envelope({ ...quota, ...(o.quota ?? {}) }))),
    http.post('*/api/v1/exports/preview', async ({ request }) => {
      calls.previews.push((await request.json()) as Record<string, unknown>)
      return HttpResponse.json(
        envelope(o.preview ?? { counts: { projects: 2, resources: 8, evidence_items: 4, documents: 1 }, estimated_size_bytes: 143360, exclusions: [] }),
      )
    }),
    http.post('*/api/v1/exports', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      const key = request.headers.get('Idempotency-Key')
      calls.created.push({ body, key })
      return o.create?.(body, key) ?? HttpResponse.json(envelope({ job_id: 41, export_job: job({ id: 41 }) }), { status: 201 })
    }),
    http.post('*/api/v1/exports/:id/cancel', ({ params }) => {
      calls.cancelled.push(String(params.id))
      return HttpResponse.json(envelope(job({ id: Number(params.id), status: 'cancelled' })))
    }),
    http.get('*/api/v1/exports/:id/manifest', ({ params }) =>
      o.manifest instanceof Response
        ? o.manifest
        : HttpResponse.json(
            envelope(
              o.manifest ?? {
                job_id: Number(params.id),
                scope: 'project',
                format: 'zip',
                created_at: '2026-10-04T10:58:00Z',
                requester: { id: 1, display_name: 'Shilan Rashid' },
                files: ['projects/project_12.json'],
              },
            ),
          ),
    ),
    http.get('*/api/v1/exports/:id', ({ params }) => {
      const found = (jobs as { id: number }[]).find((j) => j.id === Number(params.id))
      return found ? HttpResponse.json(envelope(found)) : HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'nope' } }, { status: 404 })
    }),
    http.get('*/api/v1/exports/:id/parts/:pid/download', ({ request, params }) => {
      calls.downloads.push({ path: `${params.id}/${params.pid}`, auth: request.headers.get('Authorization') })
      return new HttpResponse('PK-fake-zip', { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename=export_${params.id}_part_${params.pid}.zip` } })
    }),
    http.get('*/api/v1/projects', ({ request }) => {
      const scope = new URL(request.url).searchParams.get('scope')
      const rows = scope === 'owned' ? [project({ id: 12, title: 'Chains of the wuḍūʾ reports' }), project({ id: 13, title: 'Sorani reading guide' })] : []
      return HttpResponse.json(envelope(rows, { ...pg(rows.length), counts: { owned: rows.length, shared: 0, archived: 0, trash: 0 } }))
    }),
  )
  return calls
}

afterEach(() => vi.restoreAllMocks())

describe('downloads model', () => {
  it('splits bytes into a value and unit that read naturally', () => {
    expect(splitBytes(0)).toEqual({ value: 0, unit: 'B' })
    expect(splitBytes(1536)).toEqual({ value: 1.5, unit: 'KB' })
    expect(splitBytes(640 * 1024 * 1024)).toEqual({ value: 640, unit: 'MB' })
    expect(splitBytes(2.1 * 1024 ** 3)).toEqual({ value: 2.1, unit: 'GB' })
  })

  it('derives partial from the parts, and expired from the date, whatever the API still says', () => {
    const now = Date.now()
    const base = job() as unknown as ExportJob
    expect(jobState(base, now)).toBe('complete')
    expect(jobState({ ...base, expires_at: new Date(now - DAY).toISOString() }, now)).toBe('expired')
    expect(jobState({ ...base, parts: [part(), part({ id: 2, status: 'failed' })] } as ExportJob, now)).toBe('partial')
    expect(jobState({ ...base, parts: [part({ status: 'failed' })] } as ExportJob, now)).toBe('complete')
    expect(jobState({ ...base, status: 'cancelled' }, now)).toBe('cancelled')
    expect(jobState({ ...base, status: 'mystery' }, now)).toBe('unknown')
    expect(daysUntil(new Date(now + 5 * DAY).toISOString(), now)).toBe(5)
  })
})

describe('Downloads', () => {
  it('shows only what the API returns: states, project names, storage and the running count', async () => {
    mockMe()
    mockExports({
      jobs: [
        job({ id: 44, status: 'queued', progress: 'Packaging objects...', parts: [], file_size: null }),
        job({ id: 43, scope: 'account', target_id: 12, status: 'failed', failure_reason: 'Unable to create zip archive.', parts: [] }),
        job({ id: 42, status: 'cancelled' }),
        job({ id: 41, status: 'completed', expires_at: new Date(Date.now() - DAY).toISOString() }),
        job({ id: 40 }),
      ],
    })
    renderApp('/downloads', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'Downloads' })).toBeInTheDocument()
    expect(await screen.findByText('5 exports · 0 running · 1 queued')).toBeInTheDocument()
    expect(screen.getByText('2.1 GB of 5 GB used')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Download storage' })).toHaveAttribute('aria-valuenow', String(quota.used_bytes))
    expect(screen.getByText('1 of 2 exports running at once')).toBeInTheDocument()

    // Nothing is invented: the only jobs are the five above.
    expect(screen.getAllByText(/^EXP-00\d\d$/)).toHaveLength(5)
    expect(screen.getByText('Queued')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(screen.getByText('Cancelled')).toBeInTheDocument()
    expect(screen.getByText('Expired')).toBeInTheDocument()
    expect(screen.getByText('Complete')).toBeInTheDocument()
    expect(screen.getByText('It failed: Unable to create zip archive.')).toBeInTheDocument()
    expect(screen.getByText('All research · account-wide')).toBeInTheDocument()
    expect((await screen.findAllByText('Project ZIP · Chains of the wuḍūʾ reports')).length).toBeGreaterThan(0)
  })

  it('shows the first-run state with what can be downloaded', async () => {
    mockMe()
    mockExports({ jobs: [] })
    renderApp('/downloads', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'No downloads yet' })).toBeInTheDocument()
    expect(screen.getByText('All your research')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Start an export' }))
    expect(await screen.findByRole('heading', { name: 'New export' })).toBeInTheDocument()
  })

  it('says exports are unavailable to an account that is not approved', async () => {
    mockMe()
    mockExports({
      listResponse: HttpResponse.json({ success: false, error: { code: 'ACCOUNT_NOT_APPROVED', message: 'Only approved accounts.' } }, { status: 403 }),
    })
    renderApp('/downloads', { signedIn: true })
    expect(await screen.findByRole('heading', { name: "Exports aren't available to your account" })).toBeInTheDocument()
  })

  it('keeps the page and offers a retry when the list fails, without showing server text', async () => {
    mockMe()
    mockExports({ listResponse: HttpResponse.json({ success: false, error: { message: 'SQLSTATE boom' } }, { status: 500 }) })
    renderApp('/downloads', { signedIn: true })
    expect(await screen.findByRole('heading', { name: "Downloads couldn't be loaded" })).toBeInTheDocument()
    expect(screen.queryByText(/SQLSTATE/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('cancels a queued export, and offers no cancel for a finished one', async () => {
    mockMe()
    const calls = mockExports({ jobs: [job({ id: 44, status: 'queued', parts: [] }), job({ id: 40 })] })
    renderApp('/downloads', { signedIn: true })
    const buttons = await screen.findAllByRole('button', { name: 'Cancel' })
    expect(buttons).toHaveLength(1)
    await userEvent.click(buttons[0]!)
    await waitFor(() => expect(calls.cancelled).toEqual(['44']))
  })

  it('downloads a part with the sign-in token and saves it', async () => {
    mockMe()
    const calls = mockExports()
    const create = vi.fn(() => 'blob:fake')
    URL.createObjectURL = create
    URL.revokeObjectURL = vi.fn()
    renderApp('/downloads', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Download part 1 EXP-0040' }))
    await waitFor(() => expect(calls.downloads).toHaveLength(1))
    expect(calls.downloads[0]).toEqual({ path: '40/1', auth: 'Bearer test-token' })
    await waitFor(() => expect(create).toHaveBeenCalled())
  })

  it('says why a download did not start when the server refuses it', async () => {
    mockMe()
    mockExports()
    server.use(
      http.get('*/api/v1/exports/:id/parts/:pid/download', () =>
        HttpResponse.json({ success: false, error: { code: 'ACCESS_REVOKED', message: 'Your researcher account access has been revoked or suspended.' } }, { status: 403 }),
      ),
    )
    renderApp('/downloads', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Download part 1 EXP-0040' }))
    // The title and the server's own message are separate elements in one alert.
    expect(await screen.findByRole('alert')).toHaveTextContent(/The download didn't start\. Your researcher account access has been revoked/)
  })

  it('marks a package with a failed part as partial and keeps the ready part downloadable', async () => {
    mockMe()
    mockExports({ jobs: [job({ parts: [part(), part({ id: 2, name: 'p2.zip', status: 'failed', size: null, size_bytes: null })] })] })
    renderApp('/downloads', { signedIn: true })
    expect(await screen.findByText('Partial')).toBeInTheDocument()
    expect(screen.getByText(/This package is not complete/)).toBeInTheDocument()
    expect(screen.getByText('Part 2 · failed')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Download part/ })).toHaveLength(1)
  })

  it('warns when the server blocks a part', async () => {
    mockMe()
    mockExports({ jobs: [job({ parts: [part(), part({ id: 2, status: 'blocked' })] })] })
    renderApp('/downloads', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'Part of a package is blocked' })).toBeInTheDocument()
  })

  it('never offers Retry, because the server does not re-run a retried export', async () => {
    mockMe()
    mockExports({ jobs: [job({ status: 'failed', parts: [] })] })
    renderApp('/downloads', { signedIn: true })
    await screen.findByText('Failed')
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start it again' })).toBeInTheDocument()
  })
})

describe('New export', () => {
  it('previews an account-wide export and starts it with one idempotency key and only the format that is produced', async () => {
    mockMe()
    const calls = mockExports()
    renderApp('/downloads?view=new', { signedIn: true })
    expect(await screen.findByText('Evidence items')).toBeInTheDocument()
    expect(screen.getByText('140 KB'.replace('140', '140'), { exact: false })).toBeInTheDocument()
    expect(screen.getByText(/Rights restrictions on attachments are not checked yet/)).toBeInTheDocument()
    expect(calls.previews[0]).toEqual({ scope: 'account' })

    await userEvent.click(screen.getByRole('button', { name: 'Start export' }))
    await waitFor(() => expect(calls.created).toHaveLength(1))
    expect(calls.created[0]!.body).toEqual({ scope: 'account', formats: ['zip'] })
    expect(calls.created[0]!.key).toMatch(/^[0-9a-f-]{36}$/)
    expect(await screen.findByText('Export EXP-0041 complete.')).toBeInTheDocument()
  })

  it('does not offer formats it cannot produce, or scopes that start elsewhere', async () => {
    mockMe()
    mockExports()
    renderApp('/downloads?view=new', { signedIn: true })
    expect(await screen.findByText(/HTML, CSV, BibTeX, RIS and PDF aren't produced yet/)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Selected resources/ })).toBeDisabled()
    expect(screen.getByRole('radio', { name: /One document/ })).toBeDisabled()
  })

  it('needs at least one project for a project export, and sends the chosen ones with the library option', async () => {
    mockMe()
    const calls = mockExports()
    renderApp('/downloads?view=new', { signedIn: true })
    await userEvent.click(await screen.findByRole('radio', { name: /Selected projects/ }))
    expect(screen.getByRole('button', { name: 'Start export' })).toBeDisabled()
    await userEvent.click(await screen.findByRole('checkbox', { name: /Chains of the wuḍūʾ reports/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Also include My Library' }))
    await userEvent.click(screen.getByRole('button', { name: 'Start export' }))
    await waitFor(() => expect(calls.created).toHaveLength(1))
    expect(calls.created[0]!.body).toEqual({ scope: 'project', project_ids: [12], include_personal_library: true, formats: ['zip'] })
  })

  it('accepts the bare job a repeated request answers with', async () => {
    mockMe()
    mockExports({ create: () => HttpResponse.json(envelope(job({ id: 41 })), { status: 200 }) })
    renderApp('/downloads?view=new', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Start export' }))
    expect(await screen.findByText('Export EXP-0041 complete.')).toBeInTheDocument()
  })

  it('explains the concurrent-export limit in plain words', async () => {
    mockMe()
    mockExports({
      create: () => HttpResponse.json({ success: false, error: { code: 'LIMIT_EXCEEDED', message: 'Concurrent export limit reached (2 maximum).' } }, { status: 429 }),
    })
    renderApp('/downloads?view=new', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Start export' }))
    expect(await screen.findByText('You can run 2 exports at once. Wait for one to finish.')).toBeInTheDocument()
  })

  it('refuses to start an export that would not fit in the remaining storage', async () => {
    mockMe()
    mockExports({
      quota: { used_bytes: 5 * 1024 ** 3 - 1024, limit_bytes: 5 * 1024 ** 3 },
      preview: { counts: { projects: 1, resources: 1, evidence_items: 1, documents: 1 }, estimated_size_bytes: 10 * 1024 * 1024 },
    })
    renderApp('/downloads?view=new', { signedIn: true })
    expect(await screen.findByText(/more than your remaining storage/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start export' })).toBeDisabled()
  })

  it('starts an expired export again with the same scope filled in', async () => {
    mockMe()
    mockExports({ jobs: [job({ id: 41, expires_at: new Date(Date.now() - DAY).toISOString() })] })
    renderApp('/downloads', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Start it again' }))
    expect(await screen.findByRole('radio', { name: /Selected projects/ })).toBeChecked()
    expect(await screen.findByRole('checkbox', { name: /Chains of the wuḍūʾ reports/ })).toBeChecked()
  })
})

describe('Manifest', () => {
  it('shows what the manifest records and says plainly what it does not', async () => {
    mockMe()
    mockExports()
    renderApp('/downloads?view=manifest&job=40', { signedIn: true })
    expect(await screen.findByRole('heading', { name: 'EXP-0040 · Package manifest' })).toBeInTheDocument()
    expect(await screen.findByText('Shilan Rashid')).toBeInTheDocument()
    expect(screen.getByText('projects/project_12.json')).toBeInTheDocument()
    expect(await screen.findByText('export_40_part_1.zip')).toBeInTheDocument()
    expect(screen.getByText('ab12cd34ef567890')).toBeInTheDocument()
    expect(screen.getByText(/doesn't list how many objects each file holds yet/)).toBeInTheDocument()
    expect(screen.getByText(/doesn't list what was left out, or why/)).toBeInTheDocument()
  })

  it('says an export that is not yours is not available', async () => {
    mockMe()
    mockExports({ manifest: HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'nope' } }, { status: 404 }) })
    renderApp('/downloads?view=manifest&job=999', { signedIn: true })
    expect(await screen.findByRole('heading', { name: "That export isn't available" })).toBeInTheDocument()
  })

  it('goes back to the list', async () => {
    mockMe()
    mockExports()
    renderApp('/downloads?view=manifest&job=40', { signedIn: true })
    await userEvent.click(await screen.findByRole('button', { name: '← Downloads' }))
    const list = await screen.findByRole('heading', { name: 'Downloads' })
    expect(within(list.closest('section')!).getByText('EXP-0040')).toBeInTheDocument()
  })
})
