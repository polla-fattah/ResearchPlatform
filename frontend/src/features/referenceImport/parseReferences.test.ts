import { describe, expect, it } from 'vitest'
import { detectFormat, parseReferences } from './parseReferences'

const ok = (text: string) => {
  const r = parseReferences(text)
  if (!r.ok) throw new Error(`not ok: ${r.reason}`)
  return r
}

describe('parseReferences', () => {
  it('reads BibTeX entries with braced and quoted values, several authors and nested braces', () => {
    const r = ok(`% comment
@book{hajar1325,
  title = {Tahdhīb al-Tahdhīb: {The} {Qur'an} in context},
  author = "Ibn Ḥajar and Others, A.",
  year = 1325,
  publisher = {Dār Ṣādir},
  doi = {10.1/x}
}

@article{ali2020, title={Wuḍūʾ \\& purity}, author={Ali, M.}, journal={Journal of Hadith}, year={2020}, url={https://example.org/a@b}}
`)
    expect(r.format).toBe('bibtex')
    expect(r.entries).toHaveLength(2)
    expect(r.entries[0]).toMatchObject({ key: 'hajar1325', type: 'book', title: "Tahdhīb al-Tahdhīb: The Qur'an in context", author: 'Ibn Ḥajar; Others, A.', year: '1325', publisher: 'Dār Ṣādir', doi: '10.1/x', line: 2 })
    expect(r.entries[1]).toMatchObject({ key: 'ali2020', title: 'Wuḍūʾ & purity', publisher: 'Journal of Hadith', url: 'https://example.org/a@b' })
  })

  it('skips @comment, @string and @preamble and keeps entries after them', () => {
    const r = ok('@string{x = "y"}\n@comment{ignore {this}}\n@misc{a, title={One}}\n@preamble{"x"}\n@misc{b, title={Two}}')
    expect(r.entries.map((e) => e.title)).toEqual(['One', 'Two'])
  })

  it('marks an entry with no title and does not invent one or an author', () => {
    const r = ok('@misc{a, author={X}}\n@misc{b, title={T}}')
    expect(r.entries[0]).toMatchObject({ title: '', problems: ['noTitle'] })
    expect(r.entries[1]).toMatchObject({ author: '', problems: [] })
  })

  it('reads RIS records, several authors, the year from a date and the end marker', () => {
    const r = ok('TY  - JOUR\nID  - ali20\nTI  - Wuḍūʾ studies\nAU  - Ali, M.\nAU  - Kamal, A.\nPY  - 2020/05/01\nJO  - Journal of Hadith\nDO  - 10.1/y\nUR  - https://example.org\nER  - \n\nTY  - BOOK\nT1  - Second\nER  - ')
    expect(r.format).toBe('ris')
    expect(r.entries).toHaveLength(2)
    expect(r.entries[0]).toMatchObject({ key: 'ali20', type: 'JOUR', title: 'Wuḍūʾ studies', author: 'Ali, M.; Kamal, A.', year: '2020', publisher: 'Journal of Hadith', doi: '10.1/y', line: 1 })
    expect(r.entries[1]).toMatchObject({ type: 'BOOK', title: 'Second', year: null, line: 12 })
  })

  it('reads a RIS record that has no end marker', () => {
    expect(ok('TY  - GEN\nTI  - Only one').entries).toHaveLength(1)
  })

  it('says what is wrong with a file it cannot read', () => {
    expect(parseReferences('')).toMatchObject({ ok: false, reason: 'empty' })
    expect(parseReferences('<?xml version="1.0"?><xml><records/></xml>')).toMatchObject({ ok: false, reason: 'unreadable', firstLine: '<?xml version="1.0"?><xml><records/></xml>' })
    expect(parseReferences('@comment{nothing}')).toMatchObject({ ok: false, reason: 'noEntries' })
  })

  it('detects the format from the first line', () => {
    expect(detectFormat('TY  - BOOK\n')).toBe('ris')
    expect(detectFormat('\n  @book{a,}')).toBe('bibtex')
    expect(detectFormat('hello')).toBeNull()
  })

  it('does not hang on an unclosed entry', () => {
    expect(parseReferences('@book{a, title={never closed').ok).toBe(false)
  })
})
