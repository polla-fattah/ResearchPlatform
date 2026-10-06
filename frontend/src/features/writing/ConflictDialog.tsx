import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SaveConflict } from '@/api/schemas/writing'
import { usePreferences } from '@/app/preferencesContext'
import { MutationNotice } from '@/components/MutationNotice'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import styles from './Writing.module.css'

interface Props {
  conflict: SaveConflict
  /** The person's own unsaved text, and the version it was written on top of. */
  mine: string
  baseVersion: number
  /** The error from a "save mine on top" that has just failed again. */
  error: unknown
  busy: boolean
  onOpenTheirs: () => void
  onSaveMine: () => void
  onLater: () => void
}

/**
 * Shown when the server refuses a save because someone saved a newer version first. Both texts are on screen, and
 * every choice keeps both: "open theirs" shelves the person's own text beside the editor, "save mine" puts it on top of
 * theirs as a new version (their version stays in the history), and "decide later" changes nothing.
 */
export function ConflictDialog({ conflict, mine, baseVersion, error, busy, onOpenTheirs, onSaveMine, onLater }: Props) {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const [copied, setCopied] = useState(false)
  const who = conflict.current_author ?? t('writing.conflict.someone')
  const when = conflict.saved_at ? date(conflict.saved_at, { time: true }) : ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(mine)
      setCopied(true)
    } catch {
      /* the text is on screen and can be selected by hand */
    }
  }

  return (
    <Modal title={t('writing.conflict.title')} onClose={onLater} wide>
      <h3>{t('writing.conflict.heading', { who })}</h3>
      <p>{t('writing.conflict.body', { who, version: conflict.current_version, when, base: baseVersion })}</p>

      <div className={styles.conflictGrid}>
        <section aria-label={t('writing.conflict.theirs', { version: conflict.current_version, who, when })}>
          <h4>{t('writing.conflict.theirs', { version: conflict.current_version, who, when })}</h4>
          <pre className={styles.conflictText} dir="auto">
            <BidiText>{conflict.current_content ?? ''}</BidiText>
          </pre>
        </section>
        <section aria-label={t('writing.conflict.mine')}>
          <h4>{t('writing.conflict.mine')}</h4>
          <pre className={styles.conflictText} dir="auto">
            <BidiText>{mine}</BidiText>
          </pre>
        </section>
      </div>

      <p className={styles.hint}>{t('writing.conflict.noRealtime')}</p>
      <MutationNotice error={error} title={t('writing.conflict.failed')} />

      <div className={styles.dialogActions}>
        <Button onClick={() => void copy()}>{copied ? t('writing.conflict.copied') : t('writing.conflict.copy')}</Button>
        <Button onClick={onLater} disabled={busy}>
          {t('writing.conflict.cancel')}
        </Button>
        <Button onClick={onOpenTheirs} disabled={busy}>
          {t('writing.conflict.openTheirs', { version: conflict.current_version })}
        </Button>
        <Button variant="primary" onClick={onSaveMine} disabled={busy}>
          {t('writing.conflict.saveMine', { version: conflict.current_version + 1 })}
        </Button>
      </div>
    </Modal>
  )
}
