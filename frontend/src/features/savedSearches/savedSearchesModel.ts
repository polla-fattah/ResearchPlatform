import type { Definition } from '../search/searchModel'

/**
 * Where a saved search opens in a project: the project's search workspace with the text, mode and filters already in
 * the form (the workspace keeps all of them in its address). Nothing is run, so nothing is recorded, until the
 * researcher runs it there.
 */
export function searchPath(projectId: number, def: Definition): string {
  const params = new URLSearchParams()
  params.set('q', def.q)
  params.set('mode', def.mode)
  if (def.filters.hukm_id) params.set('hukm', String(def.filters.hukm_id))
  if (def.filters.narrator_id) {
    params.set('narrator', String(def.filters.narrator_id))
    if (def.filters.narrator_label) params.set('nlabel', def.filters.narrator_label)
  }
  return `/projects/${projectId}/searches?${params.toString()}`
}

/** The filters a saved search carries, as the labels the search workspace shows for them. Empty when it has none. */
export function filterParts(def: Definition, label: { hukm: (id: number) => string; narrator: (name: string) => string }): string[] {
  const parts: string[] = []
  if (def.filters.hukm_id) parts.push(label.hukm(def.filters.hukm_id))
  if (def.filters.narrator_id) parts.push(label.narrator(def.filters.narrator_label ?? `#${def.filters.narrator_id}`))
  return parts
}
