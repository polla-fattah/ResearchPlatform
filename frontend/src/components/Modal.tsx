import { useEffect, useId, useRef, type ReactNode } from 'react'
import styles from './Dialog.module.css'

interface Props {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}

/**
 * A modal dialog that is mounted only while it is open (so closed dialogs never leave text in the
 * page), opened with showModal() for focus trapping, closed by Escape through onClose.
 */
export function Modal({ title, children, onClose, wide }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const el = ref.current
    if (el && !el.open) el.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className={[styles.dialog, wide ? styles.wide : ''].join(' ')}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  )
}
