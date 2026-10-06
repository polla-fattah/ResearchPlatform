import { defineConfig } from '@playwright/test'

/**
 * Browser checks of the BUILT app (accessibility, right-to-left layout, a few journeys). The server's API is answered by
 * `e2e/support/mockApi.ts`, so these run without the backend. Run `npm run build` first, then `npm run e2e`.
 * Against a live backend, set E2E_LIVE=1 and the tests that need a seeded server stop mocking (see the journeys file).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1280, height: 900 },
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
