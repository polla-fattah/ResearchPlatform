// Merges src/i18n/locales/<section>.en.json into en.json under the key <section>, then deletes the part file.
//
//   node scripts/merge-i18n.mjs downloads evidence
//
// The part file holds the section's INNER object (no wrapper key). Writing it with the editor tools and merging it
// here avoids hand-editing a very large JSON file. The section is replaced as a whole, so a screen that is rebuilt
// can ship a clean set of strings. ckb.json and ar.json are not touched (specialist translation, they fall back).
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales')
const sections = process.argv.slice(2)
if (sections.length === 0) {
  console.error('usage: node scripts/merge-i18n.mjs <section> [<section> ...]')
  process.exit(1)
}

const target = join(dir, 'en.json')
const read = (file) => JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, '')) // tolerate a BOM
const en = read(target)

for (const section of sections) {
  const part = join(dir, `${section}.en.json`)
  if (!existsSync(part)) {
    console.error(`missing ${part}`)
    process.exit(1)
  }
  const value = read(part)
  if (value && typeof value === 'object' && Object.keys(value).length === 1 && section in value) {
    console.error(`${section}.en.json has a wrapper key "${section}"; it must hold the inner object only`)
    process.exit(1)
  }
  en[section] = value
  unlinkSync(part)
  console.log(`merged ${section} (${Object.keys(value).length} top-level keys)`)
}

writeFileSync(target, `${JSON.stringify(en, null, 2)}\n`)
