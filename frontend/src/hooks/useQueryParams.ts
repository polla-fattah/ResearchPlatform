import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

type Value = string | number | null | undefined
export type ParamChanges = Record<string, Value>

/**
 * Shareable view state lives in the address (state rule S2): filters, search text, sort, tab, page, selected id.
 * A page that uses this hook has no `useState` for any of them, so reload, the back button and a pasted link all
 * land on the same view.
 *
 * `set` merges changes into the *latest* parameters, including changes made earlier in the same event, so two quick
 * updates never overwrite each other. Changing anything but the page puts the page back to 1 unless `keepPage`.
 * Empty values remove the parameter (so defaults stay out of the address). Changes replace the history entry by default
 * (filters and typing must not fill the back button); `push: true` adds an entry, for moving between views of one page.
 */
export function useQueryParams() {
  const [params, setParams] = useSearchParams()

  // The newest parameters, so a handler or timer created a moment ago still merges into the current address.
  const latest = useRef(params)
  useEffect(() => {
    latest.current = params
  }, [params])

  const set = useCallback(
    (changes: ParamChanges, options: { keepPage?: boolean; push?: boolean } = {}) => {
      const next = new URLSearchParams(latest.current)
      for (const [name, value] of Object.entries(changes)) {
        if (value === null || value === undefined || value === '') next.delete(name)
        else next.set(name, String(value))
      }
      if (!options.keepPage && !('page' in changes)) next.delete('page')
      latest.current = next
      setParams(next, { replace: !options.push })
    },
    [setParams],
  )

  /** Replaces every parameter at once (for "clear all", or to open another view of the page with `push`). */
  const replaceAll = useCallback(
    (values: ParamChanges = {}, options: { push?: boolean } = {}) => {
      const next = new URLSearchParams()
      for (const [name, value] of Object.entries(values)) {
        if (value !== null && value !== undefined && value !== '') next.set(name, String(value))
      }
      latest.current = next
      setParams(next, { replace: !options.push })
    },
    [setParams],
  )

  return {
    params,
    set,
    replaceAll,
    /** The parameter's text, or '' when it is absent. */
    text: (name: string): string => params.get(name) ?? '',
    /** A positive whole number, or undefined (ids, counts). */
    id: (name: string): number | undefined => {
      const n = Number(params.get(name))
      return Number.isInteger(n) && n > 0 ? n : undefined
    },
    /** One of a fixed list of values, otherwise the fallback (tabs, scopes, sorts). */
    oneOf: <T extends string>(name: string, allowed: readonly T[], fallback: T): T => {
      const v = params.get(name)
      return v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
    },
    page: Number(params.get('page')) > 0 ? Math.floor(Number(params.get('page'))) : 1,
  }
}

/**
 * A text box whose text belongs in the address, but is applied only after a pause (`delay`) or when `commit` is called
 * (a form submit). The text the person has typed so far is the only local copy, and it is dropped automatically as soon
 * as the address changes underneath it (back button, "clear"), with no effect that copies the address into state.
 *
 *   const search = useDraftParam('q', { delay: 300 })
 *   <input value={search.text} onChange={(e) => search.setText(e.target.value)} />
 */
export function useDraftParam(name: string, options: { delay?: number } = {}) {
  const { params, set } = useQueryParams()
  const applied = params.get(name) ?? ''

  // `base` is what the address held when typing started; if the address no longer holds it, the draft is stale.
  const [draft, setDraft] = useState<{ base: string; value: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const text = draft !== null && draft.base === applied ? draft.value : applied

  const commit = useCallback(
    (value: string) => {
      clearTimeout(timer.current)
      set({ [name]: value.trim() })
    },
    [name, set],
  )

  const setText = (value: string) => {
    setDraft({ base: applied, value })
    clearTimeout(timer.current)
    if (options.delay) timer.current = setTimeout(() => commit(value), options.delay)
  }

  return {
    text,
    setText,
    /** Applies the text now (Enter / submit). Defaults to what is in the box. */
    commit: (value: string = text) => commit(value),
    /** Forgets what was typed and shows the address again. */
    reset: () => {
      clearTimeout(timer.current)
      setDraft(null)
    },
  }
}
