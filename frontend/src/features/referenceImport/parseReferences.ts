/**
 * Reads a reference list exported from a reference manager (BibTeX or RIS) in the browser. The server's BibTeX reader is
 * not used: it cuts a value at its first closing brace, breaks on an "@" inside a value, and its import saves to a shared
 * catalogue and not to the person's library (request file C-43).
 */
export type ReferenceFormat = 'bibtex' | 'ris'

export interface ReferenceEntry {
  /** The cite key (BibTeX) or ID (RIS); empty if the file gave none. */
  key: string
  /** The entry type as written: "book", "article" (BibTeX) or "JOUR", "BOOK" (RIS). */
  type: string
  title: string
  /** Authors joined with "; ". Empty when the file names none; it is never replaced by a made-up name. */
  author: string
  year: string | null
  publisher: string | null
  doi: string | null
  url: string | null
  /** 1-based line of the entry's first line. */
  line: number
  /** Why this entry cannot be imported; empty when it can. */
  problems: ('noTitle')[]
}

export type ParseResult =
  | { ok: true; format: ReferenceFormat; entries: ReferenceEntry[] }
  | { ok: false; reason: 'empty' | 'unreadable' | 'noEntries'; firstLine: string }

export function detectFormat(text: string): ReferenceFormat | null {
  const first = text.split(/\r?\n/).find((l) => l.trim() !== '') ?? ''
  if (/^﻿?TY {2}- /.test(first)) return 'ris'
  if (/^﻿?\s*@[A-Za-z]+\s*[{(]/.test(first) || /^\s*@[A-Za-z]+\s*[{(]/m.test(text)) return 'bibtex'
  return null
}

export function parseReferences(text: string): ParseResult {
  if (text.trim() === '') return { ok: false, reason: 'empty', firstLine: '' }
  const firstLine = (text.split(/\r?\n/).find((l) => l.trim() !== '') ?? '').slice(0, 80)
  const format = detectFormat(text)
  if (!format) return { ok: false, reason: 'unreadable', firstLine }
  const entries = format === 'ris' ? parseRis(text) : parseBibtex(text)
  return entries.length === 0 ? { ok: false, reason: 'noEntries', firstLine } : { ok: true, format, entries }
}

const clean = (s: string): string =>
  s
    .replace(/\\([&_%#$])/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const orNull = (s: string | undefined): string | null => (s && s.trim() !== '' ? s.trim() : null)
const yearOf = (s: string | undefined): string | null => /\d{4}/.exec(s ?? '')?.[0] ?? null
const lineAt = (text: string, index: number): number => text.slice(0, index).split('\n').length

// ── BibTeX ───────────────────────────────────────────────────────────────────────────────────────────────────
const SKIPPED = new Set(['comment', 'string', 'preamble'])

/** The index just after the group that opens at `open` (a "{" or "("), or -1 if it never closes. Quotes protect braces. */
function closeOf(text: string, open: number): number {
  const opener = text[open]
  const closer = opener === '(' ? ')' : '}'
  let depth = 0
  let quoted = false
  for (let i = open; i < text.length; i++) {
    const c = text[i]
    if (c === '\\') {
      i++
      continue
    }
    if (c === '"' && depth === 1 && opener === '{') quoted = !quoted
    if (quoted) continue
    if (c === opener) depth++
    else if (c === closer && --depth === 0) return i + 1
  }
  return -1
}

function bibFields(body: string): Record<string, string> {
  const fields: Record<string, string> = {}
  let i = 0
  while (i < body.length) {
    const m = /([A-Za-z][A-Za-z0-9_-]*)\s*=\s*/y
    m.lastIndex = i
    const found = m.exec(body)
    if (!found) {
      i++
      continue
    }
    const name = found[1]!.toLowerCase()
    i = m.lastIndex
    let value = ''
    if (body[i] === '{') {
      const end = closeOf(body, i)
      if (end === -1) break
      value = body.slice(i + 1, end - 1)
      i = end
    } else if (body[i] === '"') {
      let j = i + 1
      let depth = 0
      while (j < body.length && !(body[j] === '"' && depth === 0)) {
        if (body[j] === '\\') j++
        else if (body[j] === '{') depth++
        else if (body[j] === '}') depth--
        j++
      }
      value = body.slice(i + 1, j)
      i = j + 1
    } else {
      const end = /[,\s}]/.exec(body.slice(i))
      value = body.slice(i, end ? i + end.index : body.length)
      i += value.length
    }
    if (!(name in fields)) fields[name] = clean(value)
  }
  return fields
}

function parseBibtex(text: string): ReferenceEntry[] {
  const entries: ReferenceEntry[] = []
  const at = /@([A-Za-z]+)\s*([{(])/g
  let m: RegExpExecArray | null
  while ((m = at.exec(text))) {
    const type = m[1]!.toLowerCase()
    const open = m.index + m[0].length - 1
    const end = closeOf(text, open)
    if (end === -1) break
    at.lastIndex = end
    if (SKIPPED.has(type)) continue
    const inner = text.slice(open + 1, end - 1)
    const comma = inner.indexOf(',')
    const key = (comma === -1 ? inner : inner.slice(0, comma)).trim()
    const f = comma === -1 ? {} : bibFields(inner.slice(comma + 1))
    const title = f.title ?? ''
    entries.push({
      key,
      type,
      title,
      author: (f.author ?? '').split(/\s+and\s+/i).map((a) => a.trim()).filter(Boolean).join('; '),
      year: yearOf(f.year),
      publisher: orNull(f.publisher ?? f.journal ?? f.booktitle),
      doi: orNull(f.doi),
      url: orNull(f.url),
      line: lineAt(text, m.index),
      problems: title ? [] : ['noTitle'],
    })
  }
  return entries
}

// ── RIS ──────────────────────────────────────────────────────────────────────────────────────────────────────
function parseRis(text: string): ReferenceEntry[] {
  const entries: ReferenceEntry[] = []
  let current: { line: number; tags: Record<string, string[]> } | null = null
  const finish = () => {
    if (!current) return
    const t = current.tags
    const first = (...names: string[]) => names.map((n) => t[n]?.[0]).find((v) => v && v.trim() !== '')
    const title = clean(first('TI', 'T1') ?? '')
    entries.push({
      key: clean(first('ID') ?? ''),
      type: (t.TY?.[0] ?? '').trim(),
      title,
      author: [...(t.AU ?? []), ...(t.A1 ?? [])].map(clean).filter(Boolean).join('; '),
      year: yearOf(first('PY', 'Y1', 'DA')),
      publisher: orNull(clean(first('PB', 'JO', 'JF', 'T2') ?? '')),
      doi: orNull(first('DO')),
      url: orNull(first('UR')),
      line: current.line,
      problems: title ? [] : ['noTitle'],
    })
    current = null
  }
  text.split(/\r?\n/).forEach((raw, i) => {
    const m = /^﻿?([A-Z][A-Z0-9]) {2}- ?(.*)$/.exec(raw)
    if (!m) return
    const [, tag, value] = m as unknown as [string, string, string]
    if (tag === 'TY') {
      finish()
      current = { line: i + 1, tags: {} }
    }
    if (tag === 'ER') {
      finish()
      return
    }
    if (current) (current.tags[tag] ??= []).push(value)
  })
  finish()
  return entries
}
