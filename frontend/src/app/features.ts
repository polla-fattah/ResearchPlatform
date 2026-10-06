/**
 * Release flags. The mockups show R1b and later areas disabled in R1a
 * (e.g. "Notifications [R1b]"). Raise CURRENT_RELEASE as releases are enabled.
 */
export const RELEASES = ['R1a', 'R1b', 'R1c', 'R2'] as const
export type Release = (typeof RELEASES)[number]

const configured = import.meta.env.VITE_RELEASE as string | undefined
export const CURRENT_RELEASE: Release = (RELEASES as readonly string[]).includes(configured ?? '')
  ? (configured as Release)
  : 'R1a'

export function isReleaseEnabled(release: Release, current: Release = CURRENT_RELEASE): boolean {
  return RELEASES.indexOf(release) <= RELEASES.indexOf(current)
}
