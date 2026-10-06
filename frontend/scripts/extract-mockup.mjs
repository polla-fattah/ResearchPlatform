// Prints the visible text of a design mockup, one block per line, so its copy and states can be read quickly.
//
//   node scripts/extract-mockup.mjs "09 Evidence Inspector"        (name without extension)
//   node scripts/extract-mockup.mjs --data "09 Evidence Inspector" (also prints the inline <script> data)
//
// Mockups keep their fixtures in an inline script: with --data the script text is printed after the copy.
// The mockups also carry a design "review bar" (View/State chips, requirement ids, sample notices). That is for
// reviewing the design and must never be copied into the product.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const withData = args[0] === '--data'
const name = (withData ? args[1] : args[0])?.replace(/\.dc\.html$/, '')
if (!name) {
  console.error('usage: node scripts/extract-mockup.mjs [--data] "<mockup name>"')
  process.exit(1)
}

const file = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'design', 'HadithResearch', `${name}.dc.html`)
const html = readFileSync(file, 'utf8')

const text = html
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/<style[\s\S]*?<\/style>/g, '')
  .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/section|\/header|\/nav|\/aside|\/table|\/button|\/label)\s*>/gi, '\n')
  .replace(/<\/t[dh]>/gi, ' | ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&middot;/g, '·')
  .replace(/&#?\w+;/g, ' ')
  .split('\n')
  .map((l) => l.replace(/\s+/g, ' ').trim())
  .filter(Boolean)
  .join('\n')

console.log(text)

if (withData) {
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]?.trim()).filter(Boolean)
  console.log('\n===== inline script data =====\n')
  console.log(scripts.join('\n\n'))
}
