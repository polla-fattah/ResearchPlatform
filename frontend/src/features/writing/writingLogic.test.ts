import { describe, expect, it } from 'vitest'
import { diffLines, hasChanges } from './diff'
import { renderMarkdown } from './markdown'
import { chooseStart, citationText, extractCitations, groupByRelation, kindToMode, submissionGaps } from './writingModel'

describe('citations in the text', () => {
  it('numbers distinct evidence by first appearance and collects how each is cited', () => {
    const text = 'Start [@EV-0007 paraphrase] then [@EV-0004 exact] and again [@EV-0007] and [@EV-0004 exact].'
    expect(extractCitations(text)).toEqual([
      { id: 7, code: 'EV-0007', number: 1, kinds: ['paraphrase', 'ref'] },
      { id: 4, code: 'EV-0004', number: 2, kinds: ['exact'] },
    ])
  })

  it('ignores things that only look like citations', () => {
    expect(extractCitations('[@FOO-1] [@EV-] [EV-0004] @EV-0004 [@ev-0004]')).toEqual([])
    expect(extractCitations('')).toEqual([])
  })

  it('maps the short kinds to what the API stores', () => {
    expect([kindToMode('exact'), kindToMode('paraphrase'), kindToMode('ref')]).toEqual(['direct_quotation', 'paraphrase', 'reference'])
  })

  it('builds the text to insert: an exact quotation carries the wording unchanged, on one line', () => {
    expect(citationText('EV-0004', 'exact', 'تَوَضَّأَ ثَلاَثًا\nثَلاَثًا')).toBe('> «تَوَضَّأَ ثَلاَثًا ثَلاَثًا» [@EV-0004 exact]')
    expect(citationText('EV-0004', 'exact', '  ')).toBe('[@EV-0004 exact]')
    expect(citationText('EV-0007', 'paraphrase')).toBe('[@EV-0007 paraphrase]')
    expect(citationText('EV-0007', 'ref')).toBe('[@EV-0007]')
  })
})

describe('finding helpers', () => {
  const ev = (id: number, relation: string | null) => ({ id, captured_text: 'x', pivot: { relation_type: relation } })

  it('groups evidence by relation, putting anything unrecognised under unresolved', () => {
    const g = groupByRelation([ev(1, 'supporting'), ev(2, 'opposing'), ev(3, 'supporting'), ev(4, null), ev(5, 'weird')])
    expect(g.supporting.map((e) => e.id)).toEqual([1, 3])
    expect(g.opposing.map((e) => e.id)).toEqual([2])
    expect(g.unresolved.map((e) => e.id)).toEqual([4, 5])
    expect(g.contextual).toEqual([])
  })

  it('lists what a finding lacks for a public submission', () => {
    expect(submissionGaps({ limitations: '', evidence_items: [ev(1, 'supporting')] })).toEqual(['limitations', 'counter'])
    expect(submissionGaps({ limitations: 'Covers six books only.', evidence_items: [ev(1, 'supporting')] })).toEqual(['counter'])
    expect(submissionGaps({ limitations: 'Covers six books only.', evidence_items: [ev(1, 'opposing')] })).toEqual([])
    expect(submissionGaps({ limitations: null, evidence_items: [ev(1, 'unresolved')] })).toEqual(['limitations'])
  })
})

describe('line diff', () => {
  it('marks unchanged, removed and added lines', () => {
    const d = diffLines('a\nb\nc', 'a\nx\nc')
    expect(d).toEqual([
      { type: 'same', text: 'a' },
      { type: 'del', text: 'b' },
      { type: 'add', text: 'x' },
      { type: 'same', text: 'c' },
    ])
    expect(hasChanges(d)).toBe(true)
  })

  it('reports identical texts as unchanged', () => {
    expect(hasChanges(diffLines('same\ntext', 'same\ntext'))).toBe(false)
  })

  it('shows a moved paragraph as one removal and one addition', () => {
    const d = diffLines('one\ntwo\nthree', 'two\nthree\none')
    expect(d.filter((l) => l.type === 'del')).toEqual([{ type: 'del', text: 'one' }])
    expect(d.filter((l) => l.type === 'add')).toEqual([{ type: 'add', text: 'one' }])
  })

  it('handles an empty side and keeps Arabic text exactly', () => {
    expect(diffLines('', 'new')).toEqual([{ type: 'del', text: '' }, { type: 'add', text: 'new' }])
    const d = diffLines('أَنَّ النَّبِيَّ', 'أَنَّ النَّبِيَّ تَوَضَّأَ')
    expect(d).toEqual([{ type: 'del', text: 'أَنَّ النَّبِيَّ' }, { type: 'add', text: 'أَنَّ النَّبِيَّ تَوَضَّأَ' }])
  })

  it('does not stall on a very large text', () => {
    const big = Array.from({ length: 3000 }, (_, i) => `line ${i}`).join('\n')
    const changed = Array.from({ length: 3000 }, (_, i) => `other ${i}`).join('\n')
    const t0 = performance.now()
    const d = diffLines(big, changed)
    expect(performance.now() - t0).toBeLessThan(2000)
    expect(d.length).toBe(6000)
  })
})

describe('markdown preview', () => {
  it('renders headings, quotations and tables, each block in its own text direction', () => {
    const html = renderMarkdown('# Title\n\n> quoted\n\n| a | b |\n|---|---|\n| 1 | 2 |')
    expect(html).toContain('<h1 dir="auto">Title</h1>')
    expect(html).toContain('<blockquote dir="auto">')
    expect(html).toContain('<th dir="auto">a</th>')
  })

  it('does not render raw HTML from the text', () => {
    const html = renderMarkdown('<script>alert(1)</script> and <img src=x onerror=alert(1)>')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;script&gt;')
  })

  it('drops links that run code, and does not load images', () => {
    expect(renderMarkdown('[x](javascript:alert(1))')).not.toContain('href="javascript')
    expect(renderMarkdown('![alt](https://tracker.example/p.png)')).not.toContain('<img')
  })

  it('turns citations into numbers matching the citation list', () => {
    const html = renderMarkdown('First [@EV-0007 paraphrase]. Second [@EV-0004 exact]. Again [@EV-0007].')
    expect(html).toContain('data-evidence="EV-0007" data-kind="paraphrase">[1]</sup>')
    expect(html).toContain('data-evidence="EV-0004" data-kind="exact">[2]</sup>')
    expect(html).toContain('data-evidence="EV-0007" data-kind="ref">[1]</sup>')
  })

  it('keeps Arabic and Sorani text exactly', () => {
    const text = 'أَنَّ النَّبِيَّ صلى الله عليه وسلم تَوَضَّأَ ثَلاَثًا\n\nئەم دەربڕینە کۆنترە.'
    const html = renderMarkdown(text)
    expect(html).toContain('أَنَّ النَّبِيَّ صلى الله عليه وسلم تَوَضَّأَ ثَلاَثًا')
    expect(html).toContain('ئەم دەربڕینە کۆنترە.')
  })
})

describe('what the editor opens with', () => {
  const head = { version_number: 3, content: 'head text' }

  it('opens the current version when there is no draft', () => {
    expect(chooseStart(head, null, null)).toEqual({ text: 'head text', baseVersion: 3, status: 'saved', restored: null })
    expect(chooseStart(head, { draft_content: null, draft_base_version: null }, null).restored).toBeNull()
  })

  it('brings back a draft written on top of the current version', () => {
    const s = chooseStart(head, { draft_content: 'my draft', draft_base_version: 3, last_saved_at: '2026-10-06T10:00:00Z' }, null)
    expect(s).toMatchObject({ text: 'my draft', baseVersion: 3, status: 'draftSaved' })
    expect(s.restored).toEqual({ at: Date.parse('2026-10-06T10:00:00Z'), source: 'server' })
  })

  it('ignores a draft that sits on an older version, which would undo newer work (the server keeps it, C-18)', () => {
    expect(chooseStart(head, { draft_content: 'old draft', draft_base_version: 2 }, null).text).toBe('head text')
    expect(chooseStart(head, { draft_content: 'old draft', draft_base_version: null }, null).text).toBe('head text')
  })

  it('ignores a draft identical to the current version', () => {
    expect(chooseStart(head, { draft_content: 'head text', draft_base_version: 3 }, null).restored).toBeNull()
  })

  it('prefers text kept in this browser while offline, and marks it to be sent again', () => {
    const s = chooseStart(head, { draft_content: 'server draft', draft_base_version: 3 }, { text: 'kept offline', baseVersion: 3, at: 99 })
    expect(s).toMatchObject({ text: 'kept offline', status: 'dirty', restored: { at: 99, source: 'local' } })
  })

  it('ignores browser text that was written on another version', () => {
    expect(chooseStart(head, null, { text: 'kept offline', baseVersion: 2, at: 99 }).text).toBe('head text')
  })
})


describe('headings inside another page', () => {
  it('pushes a document’s headings down so the page keeps one h1', () => {
    expect(renderMarkdown('# Title\n\n## Part')).toContain('<h1')
    const pushed = renderMarkdown('# Title\n\n## Part\n\n##### Deep', { headingOffset: 2 })
    expect(pushed).not.toContain('<h1')
    expect(pushed).toContain('<h3')
    expect(pushed).toContain('<h4')
    expect(pushed).toContain('<h6') // capped at six
  })
})
