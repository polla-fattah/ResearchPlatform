import { lazy, type ComponentType } from 'react'

/**
 * A page loaded the first time its route is opened, so the first screen a person sees does not wait for every other
 * screen's code. The module is asked for by the page's own (named) export. Pages take their props from the route, so the
 * props are not checked here.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyNamed<K extends string>(load: () => Promise<Record<K, ComponentType<any>>>, name: K) {
  return lazy(() => load().then((m) => ({ default: m[name] })))
}
