import { saveLibraryItem } from './library'
import type { ReferenceEntry } from '@/features/referenceImport/parseReferences'

export type EntryOutcome =
  | { kind: 'saved'; entry: ReferenceEntry }
  | { kind: 'duplicate'; entry: ReferenceEntry }
  | { kind: 'failed'; entry: ReferenceEntry; error: unknown }

/** The tag every item of one import gets, so the import can be found (and removed) together. ISO date, not a localised one. */
export const importTag = (day: string): string => `import ${day}`

/**
 * Saves each entry to the signed-in person's library, one at a time (the server has no bulk call for the library).
 * An entry already in the library is reported as a duplicate and left alone, never overwritten; an entry that fails does
 * not stop the rest. The whole outcome is returned so nothing that happened is hidden.
 */
export async function importReferences(entries: readonly ReferenceEntry[], tag: string): Promise<EntryOutcome[]> {
  const outcomes: EntryOutcome[] = []
  for (const entry of entries) {
    try {
      const saved = await saveLibraryItem({
        resource_type: 'external',
        title: entry.title,
        author: entry.author || null,
        source_metadata: { cite_key: entry.key || null, entry_type: entry.type, year: entry.year, publisher: entry.publisher, doi: entry.doi, url: entry.url },
        tags: [tag],
      })
      outcomes.push({ kind: saved.kind === 'saved' ? 'saved' : 'duplicate', entry })
    } catch (error) {
      outcomes.push({ kind: 'failed', entry, error })
    }
  }
  return outcomes
}
