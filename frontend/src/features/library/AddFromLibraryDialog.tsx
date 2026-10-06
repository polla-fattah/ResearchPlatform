import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { attachResourceToProject, libraryKeys, listLibraryItems } from '@/api/library'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { kindOf, libraryCode } from '@/domain/libraryItem'
import { writeErrorMessage } from './writeError'
import styles from './Library.module.css'

interface Props {
  open: boolean
  projectId: number
  /** Resource ids already in the project. */
  existing: Set<number>
  onClose: () => void
}

/** "Add from My Library…": copies the chosen sources into this project's own resource list. */
export function AddFromLibraryDialog({ open, projectId, existing, onClose }: Props) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const qc = useQueryClient()
  const ref = useRef<HTMLDialogElement>(null)
  const [picked, setPicked] = useState<number[]>([])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  const library = useQuery({
    queryKey: libraryKeys.index,
    queryFn: ({ signal }) => listLibraryItems(signal),
    enabled: open,
  })
  const available = (library.data ?? []).filter((i) => !existing.has(i.resource_id))

  const add = useMutation({
    mutationFn: async () => {
      for (const rid of picked) await attachResourceToProject(projectId, rid)
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['project', projectId] })
      void qc.invalidateQueries({ queryKey: ['projects'] })
      close()
    },
  })

  const close = () => {
    add.reset()
    setPicked([])
    onClose()
  }
  const toggle = (rid: number) =>
    setPicked((cur) => (cur.includes(rid) ? cur.filter((x) => x !== rid) : [...cur, rid]))

  return (
    <dialog
      ref={ref}
      className={styles.wideDialog}
      aria-labelledby="from-library-title"
      onCancel={(e) => {
        e.preventDefault()
        close()
      }}
    >
      <h2 id="from-library-title">{t('library.fromLibrary.title')}</h2>
      <p>{t('library.fromLibrary.body')}</p>
      {library.isPending ? <p role="status">{t('states.loading.label')}</p> : null}
      {library.isError ? <p role="alert">{t('library.loadFailed.body')}</p> : null}
      {library.data && available.length === 0 ? (
        <p className={styles.hintLine}>{t('library.fromLibrary.none')}</p>
      ) : null}
      <fieldset>
        {available.map((i) => (
          <label key={i.id} className={styles.choice}>
            <input type="checkbox" checked={picked.includes(i.resource_id)} onChange={() => toggle(i.resource_id)} />
            <span>
              <BidiText>{i.resource.title}</BidiText>
              <small>
                {t(`library.type.${kindOf(i.resource.resource_type)}`)} · {libraryCode(i)}
              </small>
            </span>
          </label>
        ))}
      </fieldset>
      {add.isError ? (
        <p role="alert" className={styles.resultBad}>
          {writeErrorMessage(add.error, t)}
        </p>
      ) : null}
      <div className={styles.dialogActions}>
        <Button onClick={close} disabled={add.isPending}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" disabled={picked.length === 0 || add.isPending} onClick={() => add.mutate()}>
          {t('library.fromLibrary.add', { count: picked.length, formattedCount: n(picked.length) })}
        </Button>
      </div>
    </dialog>
  )
}
