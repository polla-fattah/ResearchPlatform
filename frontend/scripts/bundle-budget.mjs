// Fails when the built app grows past the sizes agreed in docs/frontend/FRONTEND_DEVELOPMENT_PLAN.md (G3):
//   - no single JavaScript file over 600 kB (before compression), and
//   - the files a first visit to the sign-in page needs (the entry and what it imports) under 900 kB.
// Run after `vite build`:  node scripts/bundle-budget.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const assets = join(dist, 'assets')
const MAX_FILE = 600 * 1024
const MAX_FIRST_VISIT = 900 * 1024

const files = readdirSync(assets).filter((f) => f.endsWith('.js'))
const size = (f) => statSync(join(assets, f)).size
const problems = []

for (const f of files) if (size(f) > MAX_FILE) problems.push(`${f} is ${(size(f) / 1024).toFixed(0)} kB, over the ${MAX_FILE / 1024} kB limit for one file`)

// The entry script named in index.html and the files it loads statically (import "./x.js" at the top of a chunk).
const html = readFileSync(join(dist, 'index.html'), 'utf8')
const entry = /assets\/(index-[^"]+\.js)/.exec(html)?.[1]
if (!entry) problems.push('index.html names no entry script')
else {
  const seen = new Set()
  const visit = (f) => {
    if (seen.has(f) || !files.includes(f)) return
    seen.add(f)
    const text = readFileSync(join(assets, f), 'utf8')
    // Static imports only: `from"./name.js"` or `import"./name.js"`. Dynamic `import("./name.js")` is a later fetch.
    for (const m of text.matchAll(/(?:from|import)\s*["']\.\/([^"']+\.js)["']/g)) visit(m[1])
  }
  visit(entry)
  const total = [...seen].reduce((n, f) => n + size(f), 0)
  console.log(`first visit: ${seen.size} files, ${(total / 1024).toFixed(0)} kB (limit ${MAX_FIRST_VISIT / 1024} kB)`)
  if (total > MAX_FIRST_VISIT) problems.push(`the first visit loads ${(total / 1024).toFixed(0)} kB, over the ${MAX_FIRST_VISIT / 1024} kB limit: ${[...seen].join(', ')}`)
}

if (problems.length > 0) {
  for (const p of problems) console.error(`bundle-budget: ${p}`)
  process.exit(1)
}
console.log(`bundle-budget: ok (${files.length} files, largest ${(Math.max(...files.map(size)) / 1024).toFixed(0)} kB)`)
