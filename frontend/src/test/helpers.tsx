import { render } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { RouterProvider } from 'react-router-dom'
import { AppProviders } from '@/app/providers'
import { createQueryClient } from '@/app/queryClient'
import { createTestRouter } from '@/app/router'
import { session } from '@/api/http'
import { server } from './server'

export const envelope = <T,>(data: T, extra: Record<string, unknown> = {}) => ({
  success: true,
  message: 'Success',
  data,
  meta: { timestamp: '2026-10-05T00:00:00Z', version: 'v1', ...extra },
})

export function mockMe(overrides: Record<string, unknown> = {}) {
  server.use(
    http.get('*/api/v1/auth/me', () =>
      HttpResponse.json(
        envelope({
          id: 1,
          display_name: 'Shilan Rashid',
          email: 'shilan@example.org',
          status: 'approved',
          preferred_language: 'ckb',
          profile: null,
          ...overrides,
        }),
      ),
    ),
  )
}

/** Renders the real route table at `path`, optionally with a signed-in session. */
export function renderApp(path: string | { pathname: string; state?: unknown }, opts: { signedIn?: boolean } = {}) {
  if (opts.signedIn) session.set('test-token')
  const router = createTestRouter([path])
  const utils = render(
    <AppProviders client={createQueryClient()}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { router, ...utils }
}

export const project = (over: Record<string, unknown> = {}) => ({
  id: 12,
  title: 'Chains of the wuḍūʾ reports in the Sunan collections',
  question: 'Do the Kufan chains of the "three times" wording share a common link?',
  scope: null,
  stage: 'analysing',
  is_archived: false,
  is_deleted: false,
  my_role: 'owner',
  evidence_count: 38,
  resource_count: 12,
  finding_count: 6,
  tags: [],
  languages: ['ar'],
  last_activity_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  recovery_deadline: null,
  next_action: { label: 'Review 7 candidate evidence items', target: '/projects/12/evidence?state=candidate' },
  owner: { id: 1, display_name: 'Shilan Rashid' },
  ...over,
})

/** Handlers for everything Home loads. Pass overrides to change one source. */
export function mockHomeApis(
  opts: {
    projects?: unknown[] | Response
    counts?: Record<string, number>
    exports?: unknown[] | Response
    openTasks?: number
    unread?: number | Response
  } = {},
) {
  const list = opts.projects ?? [project()]
  server.use(
    http.get('*/api/v1/projects', () =>
      list instanceof Response
        ? list
        : HttpResponse.json(
            envelope(list, {
              pagination: { current_page: 1, per_page: 5, total_items: list.length, total_pages: 1, has_more: false },
              counts: opts.counts ?? { owned: list.length, shared: 0, archived: 0, trash: 0 },
            }),
          ),
    ),
    http.get('*/api/v1/me/exports', () =>
      opts.exports instanceof Response
        ? opts.exports
        : HttpResponse.json(envelope(opts.exports ?? [], { pagination: { current_page: 1, per_page: 3, total_items: 0, total_pages: 1, has_more: false } })),
    ),
    http.get('*/api/v1/me/tasks', () =>
      HttpResponse.json(
        envelope([], {
          pagination: { current_page: 1, per_page: 1, total_items: opts.openTasks ?? 0, total_pages: 1, has_more: false },
        }),
      ),
    ),
    http.get('*/api/v1/notifications/unread-count', () =>
      opts.unread instanceof Response ? opts.unread : HttpResponse.json(envelope({ unread_count: opts.unread ?? 0 })),
    ),
  )
}
