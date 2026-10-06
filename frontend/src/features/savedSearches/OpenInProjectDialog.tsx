import { useQueries } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { listProjects } from '@/api/projects'
import { qk } from '@/api/queryKeys'
import type { SavedQuery } from '@/api/schemas/search'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { definitionOf } from '../search/searchModel'
import { searchPath } from './savedSearchesModel'
import styles from './SavedSearches.module.css'

/** Choose the project to run a personal search in. It opens that project's search workspace with the search filled in. */
export function OpenInProjectDialog({ search, onClose }: { search: SavedQuery; onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const lists = useQueries({
    queries: (['owned', 'shared'] as const).map((scope) => ({
      queryKey: qk.projects.list({ scope, per_page: 100 }),
      queryFn: ({ signal }: { signal: AbortSignal }) => listProjects({ scope, per_page: 100 }, signal),
    })),
  })
  const projects = lists.flatMap((l) => l.data?.items ?? []).filter((p, i, all) => all.findIndex((x) => x.id === p.id) === i)
  const pending = lists.some((l) => l.isPending)
  const failed = lists.some((l) => l.isError)

  return (
    <Modal title={t('savedSearches.open.title', { name: search.name })} onClose={onClose}>
      <div className={styles.dialogForm}>
        <p>{t('savedSearches.open.body')}</p>
        {pending ? <p role="status">{t('states.loading.label')}</p> : null}
        {failed ? <p role="alert">{t('savedSearches.open.failed')}</p> : null}
        {!pending && !failed && projects.length === 0 ? <p className={styles.hint}>{t('savedSearches.open.none')}</p> : null}
        <ul className={styles.projects}>
          {projects.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className={styles.projectButton}
                onClick={() => {
                  onClose()
                  navigate(searchPath(p.id, definitionOf(search)))
                }}
              >
                <BidiText>{p.title}</BidiText>
                <span className={styles.hint}>{t(`stage.${p.stage}`, { defaultValue: p.stage })}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.dialogActions}>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
        </div>
      </div>
    </Modal>
  )
}
