import { describe, expect, it } from 'vitest'
import { graphFileName } from './exchangeModel'

describe('exchange model', () => {
  it('names the argument map file after the project code', () => {
    expect(graphFileName(12)).toBe('argument-map-PRJ-0012.json')
  })
})
