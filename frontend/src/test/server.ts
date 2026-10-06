import { setupServer } from 'msw/node'

/**
 * MSW server for unit tests. Handlers are added per test (`server.use(...)`).
 * Handlers for endpoints that do not exist yet live in ./pending and must be tagged
 * `// PENDING API-n` so they can be found and replaced when the backend ships them.
 */
export const server = setupServer()
