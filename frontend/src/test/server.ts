import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

/**
 * MSW server for unit tests. Handlers are added per test (`server.use(...)`).
 * Handlers for endpoints that do not exist yet live in ./pending and must be tagged
 * `// PENDING API-n` so they can be found and replaced when the backend ships them.
 */
export const server = setupServer(
  // The rail asks for the unread count on every screen; a test that is about that overrides it with `server.use`.
  http.get('*/api/v1/notifications/unread-count', () => HttpResponse.json({ success: true, message: 'Success', data: { unread_count: 0 }, meta: { timestamp: '2026-10-05T00:00:00Z', version: 'v1' } })),
)
