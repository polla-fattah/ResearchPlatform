import { PROJECT_STAGES } from '@/domain/vocab'

/** The stages the filter offers: the project stages the owner can choose for an announcement. */
export const STAGE_FILTERS = ['', ...PROJECT_STAGES] as const

/** The first part of a text, cut at a word, for a card. Never cuts a word in half, and says nothing was cut when nothing was. */
export function excerpt(text: string, max = 220): { text: string; cut: boolean } {
  const clean = text.trim().replace(/\s+/g, ' ')
  if (clean.length <= max) return { text: clean, cut: false }
  const slice = clean.slice(0, max)
  const at = slice.lastIndexOf(' ')
  return { text: `${(at > max * 0.6 ? slice.slice(0, at) : slice).trimEnd()}…`, cut: true }
}

/** The researchers credited on a page: today only the owner, by name (request file C-26). */
export const creditedNames = (owner: { display_name?: string | null } | null | undefined): string[] =>
  owner?.display_name ? [owner.display_name] : []
