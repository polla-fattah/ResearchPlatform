import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { addAnnotation } from '@/api/evidence'
import { invalidate } from '@/api/invalidate'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { MutationNotice } from '@/components/MutationNotice'
import styles from './Comparison.module.css'

interface Props {
  projectId: number
  evidenceId: number
  /** What the note is about, for the heading ("Sunan Abī Dāwūd · 106"). */
  about: string
  onClose: () => void
}

/**
 * A researcher note on one compared text. Notes belong to the evidence item that holds the text, so they appear in
 * the evidence inspector as well, with the same visibility rules (private to the author, or shared with the project).
 */
export function AnnotateDialog({ projectId, evidenceId, about, onClose }: Props) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [body, setBody] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'project_shared'>('private')

  const add = useMutation({
    mutationFn: () =>
      addAnnotation(projectId, evidenceId, {
        annotation_kind: 'interpretation',
        body: body.trim(),
        visibility,
      }),
    onSuccess: async () => {
      await invalidate.annotationsChanged(qc, projectId, evidenceId)
      onClose()
    },
  })

  return (
    <Modal title={t('comparison.annotate.title', { about })} onClose={onClose}>
      <form
        className={styles.dialogForm}
        onSubmit={(e) => {
          e.preventDefault()
          if (body.trim()) add.mutate()
        }}
      >
        <Field label={t('evidence.annotations.body')} requirement="required">
          <textarea rows={4} dir="auto" autoFocus value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <div role="radiogroup" aria-label={t('evidence.annotations.visibilityLabel')}>
          {(['private', 'project_shared'] as const).map((v) => (
            <label key={v} className={styles.toggle}>
              <input type="radio" name="note-visibility" checked={visibility === v} onChange={() => setVisibility(v)} />
              {t(`evidence.annotations.visibility.${v}`)}
            </label>
          ))}
        </div>
        <MutationNotice error={add.error} title={t('evidence.annotations.failed2')} />
        <div className={styles.dialogActions}>
          <Button onClick={onClose} disabled={add.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={!body.trim() || add.isPending}>
            {t('evidence.annotations.save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
