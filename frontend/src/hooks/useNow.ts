import { useSyncExternalStore } from 'react'

/**
 * The current time as a value to render with (state rule S10: render never calls the clock itself).
 *
 * One shared timer ticks once a minute for every component that asks, so "5 minutes ago" and "3 days left" move on
 * by themselves and nothing else re-renders in between. The timer only runs while at least one component is listening.
 */
const TICK_MS = 60_000
const listeners = new Set<() => void>()
let current = Date.now()
let timer: ReturnType<typeof setInterval> | undefined

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    current = Date.now() // the value may be old if nothing has been listening for a while
    timer = setInterval(() => {
      current = Date.now()
      for (const l of listeners) l()
    }, TICK_MS)
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) clearInterval(timer)
  }
}

const getSnapshot = () => current

/** Milliseconds since the epoch, refreshed once a minute. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
