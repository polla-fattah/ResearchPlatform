import { describe, expect, it } from 'vitest'
import { isUsable, stageNames, taskTitles, titleTaken } from './templatesModel'

describe('templates model', () => {
  it('lists the task titles the server will create, skipping entries without one', () => {
    expect(taskTitles({ default_tasks: [{ title: ' A ' }, { title: null }, {}, { title: 'B' }] })).toEqual(['A', 'B'])
  })
  it('reads stages as text only', () => {
    expect(stageNames({ recommended_stages: ['scoping', 3, ' ', null, 'analysing'] })).toEqual(['scoping', 'analysing'])
  })
  it('treats a template with an untitled task as unusable', () => {
    expect(isUsable({ default_tasks: [{ title: 'A' }] })).toBe(true)
    expect(isUsable({ default_tasks: [{ title: 'A' }, {}] })).toBe(false)
    expect(isUsable({ default_tasks: [] })).toBe(true)
  })
  it('finds a taken title ignoring case and spacing', () => {
    expect(titleTaken(' takhrīj ', [{ id: 4, title: 'Takhrīj' }])?.id).toBe(4)
    expect(titleTaken('new', [{ id: 4, title: 'Takhrīj' }])).toBeNull()
    expect(titleTaken('  ', [{ id: 4, title: '' }])).toBeNull()
  })
})
