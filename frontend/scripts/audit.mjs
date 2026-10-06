// Project rules that a linter cannot see. Run with `npm run audit` (it is part of `npm run check`).
//
// Each rule exists because breaking it has already cost something: see docs/frontend/FRONTEND_TODO.md sections 1 to 3.
// A line that is correct but looks like a violation carries the comment `audit-ok: <reason>` on that line or the line above.
//
// LEGACY lists directories that are known to be static mockup ports waiting to be rebuilt (task C2). Their
// violations are reported but do not fail the run. The list must be empty when those tasks are done.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const LEGACY = []
// The component kit is a developer page (/dev/kit, dev builds only): English labels are fine there.
const DEV_ONLY = ['src/pages/ComponentKit.tsx']
// The one place that reads the clock for the app (rule S10); everything else asks useNow().
const CLOCK_SOURCE = 'src/hooks/useNow.ts'

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else out.push(path)
  }
  return out
}
const files = walk(SRC).map((abs) => ({ abs, rel: relative(ROOT, abs).split(sep).join('/') }))
const isTest = (f) => /\.test\.tsx?$/.test(f.rel) || f.rel.startsWith('src/test/')
const isCode = (f) => /\.tsx?$/.test(f.rel) && !isTest(f)
const isCss = (f) => f.rel.endsWith('.css')

const en = JSON.parse(readFileSync(join(SRC, 'i18n/locales/en.json'), 'utf8'))
const lookup = (key) => key.split('.').reduce((o, part) => (o && typeof o === 'object' ? o[part] : undefined), en)
const hasKey = (key) => lookup(key) !== undefined || lookup(`${key}_one`) !== undefined || lookup(`${key}_other`) !== undefined

const violations = []
const report = (file, line, rule, message) => violations.push({ file: file.rel, line, rule, message })

/** A line is exempt when it, or the line above it, carries an audit-ok comment. */
const exempt = (lines, i) => /audit-ok/.test(lines[i] ?? '') || /audit-ok/.test(lines[i - 1] ?? '')
const isComment = (text) => /^\s*(\/\/|\*|\/\*)/.test(text)

for (const file of files) {
  const lines = readFileSync(file.abs, 'utf8').split('\n')

  // ---- CSS: logical properties only, colours from tokens ----------------------------------------------------------
  if (isCss(file)) {
    const isTokens = file.rel.endsWith('styles/tokens.css')
    lines.forEach((text, i) => {
      if (exempt(lines, i)) return
      const code = text.replace(/\/\*.*?\*\//g, '')
      const n = i + 1
      if (/(^|[\s;{])(margin|padding|border)-(left|right)\b/.test(code) || /(^|[\s;{])border-(top|bottom)-(left|right)-radius\b/.test(code))
        report(file, n, 'physical-css', 'use margin-inline / padding-inline / border-inline-* (logical properties flip for RTL)')
      if (/(^|[\s;{])(left|right)\s*:/.test(code)) report(file, n, 'physical-css', 'use inset-inline-start/end instead of left/right')
      if (/text-align\s*:\s*(left|right)\b/.test(code)) report(file, n, 'physical-css', 'use text-align: start/end')
      if (/float\s*:\s*(left|right)\b/.test(code)) report(file, n, 'physical-css', 'use float: inline-start/end')
      if (!isTokens && /#[0-9a-fA-F]{3,8}\b/.test(code)) report(file, n, 'hex-colour', 'use a token from src/styles/tokens.css')
    })
  }

  if (!isCode(file)) continue
  const devOnly = DEV_ONLY.includes(file.rel)

  lines.forEach((text, i) => {
    if (exempt(lines, i) || isComment(text)) return
    const n = i + 1

    // ---- translation keys that do not exist ----------------------------------------------------------------------
    for (const m of text.matchAll(/\bt\(\s*(['"`])([^'"`$]*?)(\1|\$\{)/g)) {
      const [, quote, key, end] = m
      if (!key || /\s/.test(key)) continue
      if (end === '${') {
        // dynamic key: its fixed part must lead somewhere (a section, or the start of sibling keys)
        const cut = key.lastIndexOf('.')
        const parent = cut >= 0 ? lookup(key.slice(0, cut)) : en
        const fragment = key.slice(cut + 1)
        const ok = parent && typeof parent === 'object' && Object.keys(parent).some((k) => k.startsWith(fragment))
        if (!ok) report(file, n, 'missing-i18n-key', `dynamic key "${key}…" does not lead anywhere in en.json`)
      } else if ((quote !== '`' || !text.includes('${')) && !hasKey(key)) {
        report(file, n, 'missing-i18n-key', `"${key}" is not in en.json (the screen would show the raw key)`)
      }
    }

    // ---- text that skipped translation ---------------------------------------------------------------------------
    if (file.rel.endsWith('.tsx') && !devOnly) {
      for (const m of text.matchAll(/(?<!=)>\s*([A-Z][A-Za-z’'.,:;!?()\- ]{3,}[a-z.!?)])\s*</g)) {
        if (/^[A-Z][A-Z0-9\- ]*$/.test(m[1])) continue // codes such as "R1b"
        report(file, n, 'hardcoded-text', `"${m[1].trim()}" in JSX; use t('...')`)
      }
      for (const m of text.matchAll(/\b(placeholder|aria-label|title|alt)=["']([A-Za-z][^"']{2,})["']/g))
        report(file, n, 'hardcoded-text', `${m[1]}="${m[2]}" should come from t('...')`)
    }

    // ---- design-review leftovers and fixture data ----------------------------------------------------------------
    if (!devOnly && /data-screen-label|reviewBar|review bar|sampleNotice|illustrative fixtures|\bfixtures?\b/i.test(text))
      report(file, n, 'mockup-harness', 'design-review bar / fixture wording in product code')
    if (/Shilan Rashid|Sunan Abī Dāwūd|Sunan al-Tirmidhī|Sunan al-Nasāʾī/.test(text))
      report(file, n, 'fixture-data', 'a mockup fixture name in product code (data must come from the API)')

    // ---- state rules ---------------------------------------------------------------------------------------------
    if (/eslint-disable.*react-hooks/.test(text)) report(file, n, 'hooks-disabled', 'do not disable the hooks rules (state rule S7)')
    if (/useEffect\(\(\)\s*=>\s*\{?\s*set[A-Z]/.test(text))
      report(file, n, 'effect-sets-state', 'an effect that sets state mirrors other state (rule S7): derive it, use the URL, or key the component')
    if (!file.rel.startsWith('src/api/') && (/invalidateQueries\(/.test(text) || /queryKey:\s*\[/.test(text)))
      report(file, n, 'raw-query-key', 'use qk.* keys and invalidate.* (rule S5)')
    if (file.rel !== CLOCK_SOURCE && /Math\.random\(|Date\.now\(|new Date\(\s*\)/.test(text))
      report(file, n, 'impure-render', 'time and randomness are not read in render (rule S10); in a handler or initialiser add "audit-ok: <where>"')
  })
}

// ---- report -----------------------------------------------------------------------------------------------------
const isLegacy = (v) => LEGACY.some((p) => v.file.startsWith(p))
const failing = violations.filter((v) => !isLegacy(v))
const legacy = violations.filter(isLegacy)

for (const v of failing) console.log(`${v.file}:${v.line}  [${v.rule}]  ${v.message}`)
if (legacy.length) console.log(`\nlegacy (static mockup ports, to be rebuilt, not failing): ${legacy.length} findings in ${LEGACY.join(', ')}`)
console.log(failing.length === 0 ? `audit: ok (${files.length} files)` : `\naudit: ${failing.length} problem(s)`)
process.exit(failing.length === 0 ? 0 : 1)
