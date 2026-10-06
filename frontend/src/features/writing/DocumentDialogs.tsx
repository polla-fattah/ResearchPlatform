import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { linkFindingToDocument, updateDocument } from '@/api/documents'
import { listFindings } from '@/api/findings'
import { invalidate } from '@/api/invalidate'
import { qk } from '@/api/queryKeys'
import type { DocumentItem } from '@/api/schemas/writing'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { MutationNotice } from '@/components/MutationNotice'
import { findingCode } from './writingModel'
import styles from './Writing.module.css'

/** Rename a document. Mounted only while open, so the draft title starts from the current one every time. */
export function RenameDialog({ projectId, doc, onClose }: { projectId: number; doc: DocumentItem; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [title, setTitle] = useState(doc.title)
  const rename = useMutation({
    mutationFn: (next: string) => updateDocument(projectId, doc.id, { title: next }),
    onSuccess: async () => {
      await invalidate.documentsChanged(qc, projectId)
      onClose()
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (title.trim()) rename.mutate(title.trim())
  }
  return (
    <Modal title={t('writing.doc.renameTitle')} onClose={onClose}>
      <form className={styles.dialogForm} onSubmit={submit}>
        <Field label={t('writing.newDoc.name')} requirement="required">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <MutationNotice error={rename.error} title={t('writing.doc.renameFailed')} />
        <div className={styles.dialogActions}>
          <Button onClick={onClose} disabled={rename.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={rename.isPending || !title.trim()}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/** Link one of the project's findings to this document. */
export function LinkFindingDialog({ projectId, doc, onClose }: { projectId: number; doc: DocumentItem; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [findingId, setFindingId] = useState('')
  const findings = useQuery({
    queryKey: qk.project(projectId).findings.list({}),
    queryFn: ({ signal }) => listFindings(projectId, {}, signal),
  })
  const linked = new Set((doc.findings ?? []).map((f) => f.id))
  const choices = (findings.data?.items ?? []).filter((f) => !linked.has(f.id))

  const link = useMutation({
    mutationFn: () => linkFindingToDocument(projectId, doc.id, Number(findingId)),
    onSuccess: async () => {
      await invalidate.documentsChanged(qc, projectId)
      onClose()
    },
  })

  return (
    <Modal title={t('writing.doc.linkFindingTitle')} onClose={onClose}>
      <form
        className={styles.dialogForm}
        onSubmit={(e) => {
          e.preventDefault()
          if (findingId) link.mutate()
        }}
      >
        {findings.isPending ? <p role="status">{t('states.loading.label')}</p> : null}
        {findings.isError ? <p role="alert">{t('writing.loadFailed.body')}</p> : null}
        {findings.data && choices.length === 0 ? <p>{t('writing.doc.linkFindingNone')}</p> : null}
        {choices.length > 0 ? (
          <Field label={t('writing.doc.findingLabel')} requirement="required">
            <select value={findingId} onChange={(e) => setFindingId(e.target.value)}>
              <option value="" />
              {choices.map((f) => (
                <option key={f.id} value={f.id}>
                  {findingCode(f.id)} · {f.claim.slice(0, 80)}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <MutationNotice error={link.error} title={t('writing.doc.linkFindingFailed')} />
        <div className={styles.dialogActions}>
          <Button onClick={onClose} disabled={link.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={!findingId || link.isPending}>
            {t('writing.linkEvidence.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
