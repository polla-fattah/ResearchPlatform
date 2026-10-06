import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { addToProjects, sharePreview } from '@/api/libraryManage'
import { listProjects } from '@/api/projects'
import type { LibraryItem, ShareOptions } from '@/api/schemas/library'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { libraryCode, snapshotText } from '@/domain/libraryItem'
import styles from './Library.module.css'
import { qk } from '@/api/queryKeys'
import { invalidate } from '@/api/invalidate'
import { Modal } from '@/components/Modal'
import { MutationNotice } from '@/components/MutationNotice'

interface Props {
  item: LibraryItem
  onClose: () => void
}

const NO_SHARE: ShareOptions = { excerpt: false, tags: false, notes: false }

const OUTCOME_KEY: Record<string, string> = {
  added: 'added',
  already_in_project: 'already',
  forbidden: 'forbidden',
  project_not_found: 'notFound',
}

export function AddToProjectDialog({ item, onClose }: Props) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const qc = useQueryClient()
  const [picked, setPicked] = useState<number[]>([])
  const [share, setShare] = useState<ShareOptions>(NO_SHARE)

  // Projects you can add to: your own and the ones shared with you.
  const lists = useQueries({
    queries: (['owned', 'shared'] as const).map((scope) => ({
      queryKey: qk.projects.list({ scope, per_page: 100 }),
      queryFn: ({ signal }: { signal: AbortSignal }) => listProjects({ scope, per_page: 100 }, signal),
    })),
  })
  const projects = lists.flatMap((l) => l.data?.items ?? []).filter((p) => !p.is_archived && !p.is_deleted)

  const preview = useQuery({
    queryKey: qk.library.sharePreview(item.id, picked, share),
    queryFn: () => sharePreview(item.id, picked, share),
    enabled: picked.length > 0,
  })

  const add = useMutation({
    mutationFn: () => addToProjects(item.id, picked, share),
    onSuccess: () => {
      for (const id of picked) void invalidate.resourcesChanged(qc, id)
    },
  })

  const close = () => {
    add.reset()
    setPicked([])
    setShare(NO_SHARE)
    onClose()
  }

  const toggle = (id: number) =>
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  const text = snapshotText(item)
  const tags = item.tags ?? []
  const notes = item.notes ?? []
  const titleOf = (id: number) => projects.find((p) => p.id === id)?.title ?? `#${id}`

  const notShared = [
    !share.excerpt && text ? t('library.addProject.excerpt') : null,
    !share.tags && tags.length ? t('library.addProject.tags') : null,
    !share.notes && notes.length ? t('library.addProject.notes') : null,
  ].filter(Boolean)

  const results = add.data
  const okCount =
    results?.filter((r) => r.status === 'added' || r.status === 'already_in_project').length ?? 0

  return (
    <Modal title={t('library.addProject.title', { id: libraryCode(item) })} onClose={close} wide>
      <div className={styles.dialogBody}>
      <p>
        <BidiText>{item.resource.title}</BidiText>
      </p>

      {results ? (
        <>
          <h3>{t('library.addProject.result', { done: n(okCount), total: n(results.length) })}</h3>
          <ul className={styles.results}>
            {results.map((r) => {
              const key = OUTCOME_KEY[r.status] ?? 'failed'
              const ok = key === 'added' || key === 'already'
              return (
                <li key={r.project_id} className={ok ? '' : styles.resultBad}>
                  <span aria-hidden="true">{ok ? '✓ ' : '✕ '}</span>
                  {t(`library.addProject.${key}`, { title: titleOf(r.project_id) })}
                </li>
              )
            })}
          </ul>
          <div className={styles.dialogActions}>
            <Button variant="primary" onClick={close}>
              {t('library.addProject.done')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <fieldset>
            <legend>{t('library.addProject.projects')}</legend>
            {projects.length === 0 && !lists.some((l) => l.isPending) ? (
              <p className={styles.hintLine}>{t('library.addProject.noProjects')}</p>
            ) : null}
            {projects.map((p) => (
              <label key={p.id} className={styles.choice}>
                <input type="checkbox" checked={picked.includes(p.id)} onChange={() => toggle(p.id)} />
                <span>
                  <BidiText>{p.title}</BidiText>
                  <small>{t(`stage.${p.stage}`, { defaultValue: p.stage })}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset>
            <legend>{t('library.addProject.include')}</legend>
            <label className={styles.choice}>
              <input type="checkbox" checked disabled />
              <span>
                {t('library.addProject.record')}
                <small>{t('library.addProject.recordSub')}</small>
              </span>
            </label>
            {(['excerpt', 'tags', 'notes'] as const).map((k) => (
              <label key={k} className={styles.choice}>
                <input
                  type="checkbox"
                  checked={share[k]}
                  onChange={(e) => setShare((s) => ({ ...s, [k]: e.target.checked }))}
                />
                <span>
                  {t(`library.addProject.${k}`)}
                  <small>{t(`library.addProject.${k}Sub`)}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <section className={styles.preview} aria-label={t('library.addProject.preview')}>
            <h3>{t('library.addProject.preview')}</h3>
            <p style={{ margin: 0 }}>{t('library.addProject.previewNote')}</p>
            <ul>
              <li>
                <BidiText>{item.resource.title}</BidiText>
                {item.locator ? (
                  <>
                    {' · '}
                    <BidiText>{item.locator}</BidiText>
                  </>
                ) : null}
              </li>
              {share.excerpt && text ? (
                <li>
                  <BidiText>{text}</BidiText>
                </li>
              ) : null}
              {share.tags ? tags.map((tag) => <li key={tag}>#{tag}</li>) : null}
              {share.notes ? notes.map((note, i) => <li key={i}>{note.text}</li>) : null}
            </ul>
            {notShared.length ? (
              <p>{t('library.addProject.notShared', { list: notShared.join(', ') })}</p>
            ) : null}
            {picked.length === 0 ? <p>{t('library.addProject.pickOne')}</p> : null}
            {preview.isError ? <p role="alert">{t('library.addProject.previewFailed')}</p> : null}
            {preview.data
              ?.filter((p) => p.already_in_project)
              .map((p) => (
                <p key={p.project_id}>
                  <strong>{p.project_title}</strong>: {t('library.addProject.alreadyIn')}
                </p>
              ))}
          </section>

          <MutationNotice error={add.error} />

          <div className={styles.dialogActions}>
            <Button onClick={close} disabled={add.isPending}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={picked.length === 0 || add.isPending}
              onClick={() => add.mutate()}
            >
              {t('library.addProject.button', { count: picked.length, formattedCount: n(picked.length) })}
            </Button>
          </div>
        </>
      )}
      </div>
    </Modal>
  )
}
