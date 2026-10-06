import type { Announcement } from '@/api/schemas/announcement'

/** A web address part from a title: lower case letters, digits and single hyphens; Arabic and other scripts are kept. */
export function slugify(title: string): string {
  return title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export const SLUG_PATTERN = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u
export const isValidSlug = (slug: string) => slug.length > 0 && slug.length <= 255 && SLUG_PATTERN.test(slug)

/** Keywords typed as a list separated by commas (Latin or Arabic), semicolons or new lines; blanks and repeats dropped. */
export function parseKeywords(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of text.split(/[,،;\n]+/)) {
    const word = raw.trim()
    if (word && !seen.has(word.toLowerCase())) {
      seen.add(word.toLowerCase())
      out.push(word)
    }
  }
  return out
}

export const keywordsText = (keywords: readonly string[] | null | undefined) => (keywords ?? []).join(', ')

export type PublishGap = 'title' | 'summary' | 'slug' | 'unsaved'

/**
 * What stops an announcement from being published now: the three things the server requires, and unsaved changes (what
 * would go public is what is saved, not what is typed). `values` are the form's current values.
 */
export function publishGaps(values: { title: string; summary: string; slug: string }, dirty: boolean): PublishGap[] {
  const gaps: PublishGap[] = []
  if (!values.title.trim()) gaps.push('title')
  if (!values.summary.trim()) gaps.push('summary')
  if (!isValidSlug(values.slug.trim())) gaps.push('slug')
  if (dirty) gaps.push('unsaved')
  return gaps
}

/**
 * The status the form keeps when it saves (never called for a hidden one, see `isHidden`). The server has one row that is the public page, so saving a published
 * announcement edits the live page at once; anything else stays out of the public view.
 */
export const statusToKeep = (a: Pick<Announcement, 'status'> | null): 'draft' | 'published' | 'unpublished' =>
  a?.status === 'published' ? 'published' : a?.status === 'unpublished' ? 'unpublished' : 'draft'

export const isLive = (a: Pick<Announcement, 'status'> | null) => a?.status === 'published'

/** A moderator hid it. Saving would send a status that lifts the hiding, so the owner cannot save it here at all. */
export const isHidden = (a: Pick<Announcement, 'status'> | null) => a?.status === 'hidden'
