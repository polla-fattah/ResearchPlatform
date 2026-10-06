/**
 * Text the server could not take (the connection dropped) is kept in this browser until it can be sent, so nothing
 * typed is lost. Browser storage can be missing or full (private windows, blocked site data), so every access is
 * guarded and the editor works without it.
 */
export interface LocalDraft {
  text: string
  /** The version the text was written on top of. */
  baseVersion: number
  /** When it was kept, in ms. */
  at: number
}

const key = (projectId: number, documentId: number) => `oh.draft.${projectId}.${documentId}`

export function readLocalDraft(projectId: number, documentId: number): LocalDraft | null {
  try {
    const raw = localStorage.getItem(key(projectId, documentId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LocalDraft>
    return typeof parsed.text === 'string' && typeof parsed.baseVersion === 'number' && typeof parsed.at === 'number'
      ? { text: parsed.text, baseVersion: parsed.baseVersion, at: parsed.at }
      : null
  } catch {
    return null
  }
}

export function writeLocalDraft(projectId: number, documentId: number, draft: LocalDraft): void {
  try {
    localStorage.setItem(key(projectId, documentId), JSON.stringify(draft))
  } catch {
    /* storage unavailable: the text is still in the editor */
  }
}

export function clearLocalDraft(projectId: number, documentId: number): void {
  try {
    localStorage.removeItem(key(projectId, documentId))
  } catch {
    /* nothing to clear */
  }
}

const PREFIX = 'oh.draft.'

/**
 * Removes every kept draft. Called when the person signs out on purpose: the text of their research must not stay in a
 * browser they may share. (When a session only EXPIRES the drafts stay, so work typed while offline is not lost.)
 */
export function clearAllLocalDrafts(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(PREFIX)) keys.push(k)
    }
    keys.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* nothing to clear */
  }
}
