import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { renamePersonalSearch } from '@/api/savedSearches'
import { invalidate } from '@/api/invalidate'
import type { SavedQuery } from '@/api/schemas/search'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { MutationNotice } from '@/components/MutationNotice'
import styles from './SavedSearches.module.css'

export function RenameSearchDialog({ search, onClose }: { search: SavedQuery; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [name, setName] = useState(search.name)

  const rename = useMutation({
    mutationFn: () => renamePersonalSearch(search.id, name.trim()),
    onSuccess: async () => {
      await invalidate.savedSearchesChanged(qc)
      onClose()
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (name.trim()) rename.mutate()
  }

  return (
    <Modal title={t('savedSearches.rename.title')} onClose={onClose}>
      <form className={styles.dialogForm} onSubmit={submit}>
        <Field label={t('savedSearches.rename.name')} requirement="required">
          <input autoFocus dir="auto" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <MutationNotice error={rename.error} title={t('savedSearches.rename.failed')} />
        <div className={styles.dialogActions}>
          <Button onClick={onClose} disabled={rename.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={rename.isPending || !name.trim() || name.trim() === search.name}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
