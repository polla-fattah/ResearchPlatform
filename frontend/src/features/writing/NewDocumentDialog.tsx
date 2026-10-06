import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { createDocument } from '@/api/documents'
import { invalidate } from '@/api/invalidate'
import { DOCUMENT_TYPES } from '@/api/schemas/writing'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { MutationNotice } from '@/components/MutationNotice'
import styles from './Writing.module.css'

const LANGUAGES = ['ar', 'ckb', 'en'] as const

interface Props {
  projectId: number
  onCreated: (id: number) => void
  onClose: () => void
}

/** Start a document: a title, what kind it is and its main language. The first version is a heading with the title. */
export function NewDocumentDialog({ projectId, onCreated, onClose }: Props) {
  const { t } = useTranslation()
  const qc = useQueryClient()

  const schema = z.object({
    title: z.string().trim().min(1, t('writing.finding.required')).max(500),
    document_type: z.enum(DOCUMENT_TYPES),
    language: z.enum(LANGUAGES),
  })
  type Values = z.infer<typeof schema>
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { title: '', document_type: 'article', language: 'ar' } })

  const create = useMutation({
    mutationFn: (v: Values) => createDocument(projectId, { ...v, content: `# ${v.title}\n\n` }),
    onSuccess: async (doc) => {
      await invalidate.documentsChanged(qc, projectId)
      onCreated(doc.id)
    },
  })

  return (
    <Modal title={t('writing.newDoc.title')} onClose={onClose}>
      <form className={styles.dialogForm} onSubmit={handleSubmit((v) => create.mutate(v))} noValidate>
        <Field label={t('writing.newDoc.name')} requirement="required" error={errors.title?.message}>
          <input autoFocus dir="auto" aria-invalid={errors.title ? true : undefined} {...register('title')} />
        </Field>
        <Field label={t('writing.newDoc.type')}>
          <select {...register('document_type')}>
            {DOCUMENT_TYPES.map((d) => (
              <option key={d} value={d}>
                {t(`writing.types.${d}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('writing.newDoc.language')}>
          <select {...register('language')}>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {t(`writing.newDoc.languages.${l}`)}
              </option>
            ))}
          </select>
        </Field>
        <MutationNotice error={create.error} title={t('writing.newDoc.failed')} />
        <div className={styles.dialogActions}>
          <Button onClick={onClose} disabled={create.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {t('writing.newDoc.create')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
