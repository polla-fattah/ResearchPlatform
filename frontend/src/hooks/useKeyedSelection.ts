import { useState } from 'react'

const EMPTY: ReadonlySet<string> = new Set()

/**
 * A set of ticked items that belongs to one result set (state rule S9).
 *
 * `scopeKey` identifies what produced the items (the search text, filters and page). When it changes the selection is
 * empty again, so a tick can never refer to a row that is no longer on screen. This is derived at render time from
 * the scope recorded with the selection: no effect clears it.
 */
export function useKeyedSelection(scopeKey: string) {
  const [state, setState] = useState<{ scope: string; keys: ReadonlySet<string> }>({ scope: scopeKey, keys: EMPTY })
  const selected = state.scope === scopeKey ? state.keys : EMPTY

  const change = (fn: (current: Set<string>) => void) =>
    setState((prev) => {
      const next = new Set(prev.scope === scopeKey ? prev.keys : EMPTY)
      fn(next)
      return { scope: scopeKey, keys: next }
    })

  return {
    selected,
    toggle: (key: string) => change((s) => (s.delete(key) ? undefined : s.add(key))),
    /** Ticks or unticks a group in one go ("select all in this report"). */
    setMany: (keys: readonly string[], on: boolean) =>
      change((s) => {
        for (const key of keys) {
          if (on) s.add(key)
          else s.delete(key)
        }
      }),
    clear: () => setState({ scope: scopeKey, keys: EMPTY }),
  }
}
