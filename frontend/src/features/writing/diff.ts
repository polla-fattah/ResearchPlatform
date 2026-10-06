export type DiffLine = { type: 'same' | 'add' | 'del'; text: string }

/** Beyond this many line pairs the exact comparison is skipped (it would stall the screen). */
const MAX_CELLS = 4_000_000

/**
 * A line-by-line comparison of two texts: which lines are unchanged, which were removed from `before` and which
 * were added in `after`. It uses the longest common subsequence of lines, so a moved paragraph shows as one removal and
 * one addition and a small edit stays small. Very large texts fall back to "everything replaced" rather than freezing.
 */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split('\n')
  const b = after.split('\n')
  if (before === after) return a.map((text) => ({ type: 'same', text }))

  // Trim the common start and end first: most edits touch a small part of a long document.
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }
  const head = a.slice(0, start).map((text): DiffLine => ({ type: 'same', text }))
  const tail = a.slice(endA).map((text): DiffLine => ({ type: 'same', text }))
  const x = a.slice(start, endA)
  const y = b.slice(start, endB)

  const middle: DiffLine[] = []
  if (x.length * y.length > MAX_CELLS) {
    for (const text of x) middle.push({ type: 'del', text })
    for (const text of y) middle.push({ type: 'add', text })
  } else {
    // lcs[i][j] = length of the common subsequence of x[i..] and y[j..]
    const cols = y.length + 1
    const lcs = new Uint32Array((x.length + 1) * cols)
    for (let i = x.length - 1; i >= 0; i--) {
      for (let j = y.length - 1; j >= 0; j--) {
        lcs[i * cols + j] = x[i] === y[j] ? lcs[(i + 1) * cols + j + 1]! + 1 : Math.max(lcs[(i + 1) * cols + j]!, lcs[i * cols + j + 1]!)
      }
    }
    let i = 0
    let j = 0
    while (i < x.length && j < y.length) {
      if (x[i] === y[j]) {
        middle.push({ type: 'same', text: x[i]! })
        i++
        j++
      } else if (lcs[(i + 1) * cols + j]! >= lcs[i * cols + j + 1]!) {
        middle.push({ type: 'del', text: x[i++]! })
      } else {
        middle.push({ type: 'add', text: y[j++]! })
      }
    }
    while (i < x.length) middle.push({ type: 'del', text: x[i++]! })
    while (j < y.length) middle.push({ type: 'add', text: y[j++]! })
  }
  return [...head, ...middle, ...tail]
}

export const hasChanges = (lines: readonly DiffLine[]) => lines.some((l) => l.type !== 'same')
