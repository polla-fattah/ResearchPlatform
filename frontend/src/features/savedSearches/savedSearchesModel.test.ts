import { describe, expect, it } from 'vitest'
import { filterParts, searchPath } from './savedSearchesModel'

const parse = (path: string) => {
  const [pathname, search] = path.split('?')
  return { pathname, params: Object.fromEntries(new URLSearchParams(search)) }
}

describe('searchPath', () => {
  it('opens a project’s search workspace with the text, mode and filters in its address', () => {
    expect(parse(searchPath(12, { q: 'إنما الأعمال', mode: 'exact', filters: { hukm_id: 6, narrator_id: 31544, narrator_label: 'Muslim' } }))).toEqual({
      pathname: '/projects/12/searches',
      params: { q: 'إنما الأعمال', mode: 'exact', hukm: '6', narrator: '31544', nlabel: 'Muslim' },
    })
  })
  it('leaves out filters the search does not have, and the narrator’s name when the id is missing', () => {
    expect(parse(searchPath(3, { q: 'نية', mode: 'normalized', filters: {} })).params).toEqual({ q: 'نية', mode: 'normalized' })
    expect(parse(searchPath(3, { q: 'نية', mode: 'normalized', filters: { narrator_label: 'x' } })).params).not.toHaveProperty('nlabel')
  })
})

describe('filterParts', () => {
  const label = { hukm: (id: number) => `Ruling: ${id}`, narrator: (name: string) => `Narrator: ${name}` }
  it('describes the filters with the stored narrator name, or the id when there is none', () => {
    expect(filterParts({ q: 'x', mode: 'exact', filters: { hukm_id: 6, narrator_id: 9, narrator_label: 'Muslim' } }, label)).toEqual(['Ruling: 6', 'Narrator: Muslim'])
    expect(filterParts({ q: 'x', mode: 'exact', filters: { narrator_id: 9 } }, label)).toEqual(['Narrator: #9'])
    expect(filterParts({ q: 'x', mode: 'exact', filters: {} }, label)).toEqual([])
  })
})
