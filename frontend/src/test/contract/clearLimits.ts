import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * Many contract files create a throwaway applicant, and the apply endpoint allows ten per hour from one address, so one
 * suite run would be refused part-way. Before each file, a local backend's cache (where that limit is counted) is
 * cleared. Only for a backend on this machine: set CONTRACT_BACKEND_DIR to its folder (default ../backend), or
 * CONTRACT_NO_CLEAR=1 to leave the cache alone.
 */
const dir = process.env.CONTRACT_BACKEND_DIR ?? fileURLToPath(new URL('../../../../backend', import.meta.url))
const local = /^https?:\/\/(127\.0\.0\.1|localhost)/.test(process.env.CONTRACT_BASE_URL ?? 'http://127.0.0.1:8000')

if (local && process.env.CONTRACT_NO_CLEAR !== '1' && existsSync(`${dir}/artisan`)) {
  try {
    execFileSync('php', ['artisan', 'cache:clear'], { cwd: dir, stdio: 'ignore', timeout: 30_000 })
  } catch {
    /* no PHP here: the limit may refuse some set-ups, which then say so */
  }
}
