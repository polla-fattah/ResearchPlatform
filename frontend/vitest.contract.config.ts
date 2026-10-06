import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Contract tests call a running backend (default http://127.0.0.1:8000).
// Public and read tests are safe anywhere; the opt-in write tests (CONTRACT_WRITE=1) create and trash
// throwaway projects, so files run one at a time (one test asserts none are left outside the trash).
// Run with: npm run test:contract
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/test/contract/**/*.test.ts'],
    testTimeout: 60_000,
    fileParallelism: false,
    setupFiles: ['src/test/contract/clearLimits.ts'],
  },
})
