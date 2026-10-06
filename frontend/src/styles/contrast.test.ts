import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The colour pairs the interface draws text and controls with, checked against WCAG 2.1 (1.4.3 text 4.5:1, 1.4.11 controls 3:1).
// The table in docs/frontend/ACCESSIBILITY.md lists the same pairs with their ratios.
const css = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8')
const token = (name: string): string => {
  const hex = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)?.[1]
  if (!hex) throw new Error(`no colour token --${name}`)
  return hex
}
const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255)) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const ratio = (a: string, b: string): number => {
  const [x, y] = [luminance(token(a)), luminance(token(b))]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

const TEXT: [string, string][] = [
  ['ink', 'paper'], ['ink', 'surface'], ['ink', 'surface-white'], ['ink', 'accent-soft'], ['ink', 'surface-sunk'],
  ['ink-2', 'paper'], ['ink-2', 'surface'], ['ink-2', 'surface-white'], ['ink-2', 'surface-sunk'],
  ['muted', 'paper'], ['muted', 'surface'], ['muted', 'surface-white'], ['muted', 'surface-sunk'], ['muted', 'accent-soft'],
  ['accent', 'paper'], ['accent', 'surface'], ['accent', 'surface-white'], ['accent', 'accent-soft'],
  ['accent-dark', 'accent-soft'], ['accent-dark', 'paper'],
  ['on-accent', 'accent'], ['on-accent', 'accent-darker'],
  ['warn', 'paper'], ['warn', 'surface-white'], ['warn', 'warn-soft'], ['warn-ink', 'warn-soft'],
  ['note', 'note-soft'], ['note', 'paper'], ['attributed', 'attributed-soft'], ['attributed', 'paper'],
]
// Borders that mark a control or a state (the dashed "neutral" outline of an unknown or unavailable state).
const CONTROL: [string, string][] = [['neutral', 'paper'], ['neutral', 'surface'], ['neutral', 'surface-white']]

describe('colour contrast of the design tokens', () => {
  it.each(TEXT)('%s on %s reaches 4.5:1 for text', (fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5)
  })
  it.each(CONTROL)('%s on %s reaches 3:1 for a control outline', (fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(3)
  })
  it('the faint colour is only for disabled and decorative text (it does not reach 3:1)', () => {
    expect(ratio('faint', 'surface-white')).toBeLessThan(3)
  })
})
