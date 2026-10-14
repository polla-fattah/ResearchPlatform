// Merges src/i18n/locales/<section>.ar.json into ar.json under the key <section>, then deletes the part file.
//
//   node scripts/merge-i18n-ar.mjs core home library ...
//
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales')
const sections = process.argv.slice(2)
if (sections.length === 0) {
  console.error('usage: node scripts/merge-i18n-ar.mjs <section> [<section> ...]')
  process.exit(1)
}

const target = join(dir, 'ar.json')
const read = (file) => JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
const ar = existsSync(target) && readFileSync(target, 'utf8').trim().length > 2 ? read(target) : {}

for (const section of sections) {
  const part = join(dir, `${section}.ar.json`)
  if (!existsSync(part)) {
    console.error(`missing ${part}`)
    process.exit(1)
  }
  const value = read(part)
  if (value && typeof value === 'object' && Object.keys(value).length === 1 && section in value) {
    ar[section] = value[section]
  } else {
    ar[section] = value
  }
  unlinkSync(part)
  console.log(`merged ${section} into ar.json (${Object.keys(ar[section]).length} keys)`)
}

writeFileSync(target, `${JSON.stringify(ar, null, 2)}\n`, 'utf8')
console.log(`ar.json successfully updated! Total namespaces: ${Object.keys(ar).length}`)
