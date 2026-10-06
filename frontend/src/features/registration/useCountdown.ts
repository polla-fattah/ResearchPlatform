import { useCallback, useEffect, useState } from 'react'

/** Counts down once per second from `start` seconds; `restart(n)` begins again. */
export function useCountdown(start = 0) {
  const [remaining, setRemaining] = useState(start)

  useEffect(() => {
    if (remaining <= 0) return
    const id = setTimeout(() => setRemaining((r) => Math.max(0, r - 1)), 1000)
    return () => clearTimeout(id)
  }, [remaining])

  const restart = useCallback((seconds: number) => setRemaining(Math.max(0, Math.floor(seconds))), [])
  return [remaining, restart] as const
}

/** 52 -> "0:52" */
export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
