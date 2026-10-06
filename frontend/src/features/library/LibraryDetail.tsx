import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  addToCollection,
  removeFromCollection,
  removeLibraryItem,
  setFavourite,
  setNotes,
  setTags,
} from '@/api/libraryManage'
import type { LibraryCollection, LibraryItem } from '@/api/schemas/library'
import { usePreferences } from '@/app/preferencesContext'
import { useAuth } from '@/app/authContext'
import { NeutralState } from '@/components/Badges'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { ConfirmAction } from '@/components/ConfirmAction'
import { kindOf, libraryCode, snapshotText } from '@/domain/libraryItem'
import { AddToProjectDialog } from './AddToProjectDialog'
import { writeErrorMessage } from './writeError'
import styles from './Library.module.css'

interface Props {
  item: LibraryItem
  collections: LibraryCollection[]
  onRemoved: () => void
}

export function LibraryDetail({ item, collections, onRemoved }: Props) {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [tagText, setTagText] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [projectDialog, setProjectDialog] = useState(false)

  const tags = item.tags ?? []
  const notes = item.notes ?? []
  const flags = item.incomplete_citation_flags ?? []
  const inCollections = item.resource.collections ?? []
  const text = snapshotText(item)
  const kind = kindOf(item.resource.resource_type)
  const refresh = () => qc.invalidateQueries({ queryKey: ['library'] })

  const run = useMutation({
    mutationFn: (job: () => Promise<unknown>) => job(),
    onMutate: () => setError(null),
    onSuccess: () => refresh(),
    onError: (err) => setError(writeErrorMessage(err, t)),
  })

  const submitTag = (e: FormEvent) => {
    e.preventDefault()
    const tag = tagText.trim().replace(/^#/, '')
    if (!tag || tags.includes(tag)) return
    run.mutate(() => setTags(item.id, [...tags, tag]), { onSuccess: () => setTagText('') })
  }

  const submitNote = (e: FormEvent) => {
    e.preventDefault()
    const body = noteText.trim()
    if (!body) return
    const next = [...notes, { text: body, created_at: new Date().toISOString() }]
    run.mutate(() => setNotes(item.id, next), {
      onSuccess: () => {
        setNoteText('')
        setNoteOpen(false)
      },
    })
  }

  const remove = useMutation({
    mutationFn: () => removeLibraryItem(item.id),
    onSuccess: async () => {
      setConfirmRemove(false)
      await refresh()
      onRemoved()
    },
    onError: (err) => {
      setConfirmRemove(false)
      setError(writeErrorMessage(err, t))
    },
  })

  const availableCollections = collections.filter((c) => !inCollections.some((x) => x.id === c.id))

  return (
    <article className={styles.detail} aria-label={item.resource.title}>
      {error ? (
        <div className={styles.banner} role="alert">
          <h3>{t('library.actionFailed')}</h3>
          <p>{error}</p>
        </div>
      ) : null}

      <header className={styles.detailHead}>
        <div className={styles.detailKicker}>
          <span>{t(`library.type.${kind}`)}</span>
          <span>🔒 {t('library.private')}</span>
        </div>
        <h2>
          <BidiText>{item.resource.title}</BidiText>
        </h2>
        <dl className={styles.facts}>
          <dt>{t('library.id')}</dt>
          <dd className="mono">{libraryCode(item)}</dd>
          <dt>{t('library.locator')}</dt>
          <dd>
            {item.locator ? <BidiText>{item.locator}</BidiText> : <NeutralState kind="unknown">{t('library.noLocator')}</NeutralState>}
          </dd>
          {item.created_at ? (
            <>
              <dt>{t('library.savedOn')}</dt>
              <dd>{date(item.created_at)}</dd>
            </>
          ) : null}
          {flags.length > 0 ? (
            <>
              <dt>{t('library.flagLabel')}</dt>
              <dd>
                {flags.map((f) => (
                  <NeutralState key={f} kind="incompleteCitation">
                    {t(`library.flag.${f}`, { defaultValue: t('library.flag.other') })}
                  </NeutralState>
                ))}
              </dd>
            </>
          ) : null}
        </dl>
      </header>

      {item.source_status === 'merged' ? (
        <div className={styles.mergeBanner} role="status">
          <h3>{t('library.merged.title')}</h3>
          <p>
            {t('library.merged.body', { target: item.merged_into ?? t('common.unknown') })}
          </p>
        </div>
      ) : item.source_status === 'changed' ? (
        <div className={styles.mergeBanner} role="status">
          <h3>{t('library.changed.title')}</h3>
          <p>{t('library.changed.body')}</p>
        </div>
      ) : item.source_status === 'removed' ? (
        <div className={styles.mergeBanner} role="status">
          <h3>{t('library.removedSource.title')}</h3>
          <p>{t('library.removedSource.body')}</p>
        </div>
      ) : null}

      <section className={styles.snapshot} aria-label={t('library.snapshot', { label: t('library.snapshotSaved') })}>
        <p className={styles.snapshotLabel}>❝ {t('library.snapshot', { label: t('library.snapshotSaved') })}</p>
        {text ? (
          <p className={styles.snapshotText}>
            <BidiText>{text}</BidiText>
          </p>
        ) : (
          <NeutralState kind="unknown">{t('library.noSnapshot')}</NeutralState>
        )}
      </section>

      <div className={styles.toolbar}>
        <Button
          aria-pressed={item.is_favourite ?? false}
          disabled={run.isPending}
          onClick={() => run.mutate(() => setFavourite(item.id, !item.is_favourite))}
        >
          {item.is_favourite ? '★ ' : '☆ '}
          {item.is_favourite ? t('library.unfavourite') : t('library.favourite')}
        </Button>
        <Button variant="primary" onClick={() => setProjectDialog(true)}>
          {t('library.addToProject')}
        </Button>
        <Button disabled title={t('release.notYet', { release: 'R1b' })}>
          {t('library.openSource')}
        </Button>
      </div>

      <section className={styles.section}>
        <h3>{t('library.organise')}</h3>
        {tags.length === 0 && inCollections.length === 0 ? null : (
          <ul className={styles.chips}>
            {tags.map((tag) => (
              <li key={tag} className={styles.chip}>
                #{tag}
                <button
                  type="button"
                  aria-label={t('library.removeTag', { tag })}
                  disabled={run.isPending}
                  onClick={() =>
                    run.mutate(() =>
                      setTags(
                        item.id,
                        tags.filter((x) => x !== tag),
                      ),
                    )
                  }
                >
                  ×
                </button>
              </li>
            ))}
            {inCollections.map((c) => (
              <li key={c.id} className={styles.chip}>
                ▤ {c.name}
                <button
                  type="button"
                  aria-label={t('library.collections.remove', { name: c.name })}
                  disabled={run.isPending}
                  onClick={() => run.mutate(() => removeFromCollection(c.id, item.resource_id))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.inline}>
          <form className={styles.inline} onSubmit={submitTag}>
            <input
              aria-label={t('library.tagPlaceholder')}
              placeholder={t('library.tagPlaceholder')}
              value={tagText}
              onChange={(e) => setTagText(e.target.value)}
            />
            <Button type="submit" disabled={run.isPending || !tagText.trim()}>
              {t('library.addTag')}
            </Button>
          </form>
          <select
            aria-label={t('library.collectionPicker')}
            value=""
            disabled={run.isPending || availableCollections.length === 0}
            onChange={(e) => {
              const id = Number(e.target.value)
              if (id) run.mutate(() => addToCollection(id, item.resource_id))
            }}
          >
            <option value="">{t('library.collectionNone')}</option>
            {availableCollections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <p className={styles.hintLine}>
          {inCollections.length > 0
            ? t('library.inCollections', { collections: inCollections.map((c) => c.name).join(', ') })
            : t('library.inNoCollections')}
        </p>
      </section>

      <section className={styles.section}>
        <h3>{t('library.notes.heading')}</h3>
        {notes.length === 0 && !item.personal_notes ? (
          <p className={styles.hintLine}>{t('library.notes.none')}</p>
        ) : null}
        {item.personal_notes ? (
          <div className={styles.note}>
            <div className={styles.noteMeta}>
              <span>✎ {t('library.notes.legacy')}</span>
              <span>🔒 {t('library.private')}</span>
            </div>
            <p>
              <BidiText>{item.personal_notes}</BidiText>
            </p>
          </div>
        ) : null}
        {notes.map((note, i) => (
          <div key={note.id ?? i} className={styles.note}>
            <div className={styles.noteMeta}>
              <span>✎ {t('library.notes.author', { name: user?.display_name ?? '' })}</span>
              <span>🔒 {t('library.private')}</span>
              {note.created_at ? <span>{date(note.created_at)}</span> : null}
            </div>
            <p>
              <BidiText>{note.text}</BidiText>
            </p>
          </div>
        ))}
        {noteOpen ? (
          <form className={styles.noteForm} onSubmit={submitNote}>
            <textarea
              aria-label={t('library.notes.placeholder')}
              placeholder={t('library.notes.placeholder')}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
            <div className={styles.inline}>
              <Button type="submit" variant="primary" disabled={run.isPending || !noteText.trim()}>
                {t('library.notes.save')}
              </Button>
              <Button onClick={() => setNoteOpen(false)}>{t('common.cancel')}</Button>
            </div>
          </form>
        ) : (
          <Button onClick={() => setNoteOpen(true)}>{t('library.notes.add')}</Button>
        )}
      </section>

      <section className={styles.section}>
        <h3>{t('library.usedIn.heading')}</h3>
        <p className={styles.unavailableNote}>{t('library.usedIn.unavailable')}</p>
      </section>

      <section className={styles.danger}>
        <Button variant="danger" onClick={() => setConfirmRemove(true)}>
          {t('library.remove.action')}
        </Button>
        <p>{t('library.remove.note')}</p>
      </section>

      <ConfirmAction
        open={confirmRemove}
        danger
        title={t('library.remove.title', { title: item.resource.title })}
        confirmLabel={t('library.remove.confirm')}
        busy={remove.isPending}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => remove.mutate()}
      >
        <p>{t('library.remove.body')}</p>
        <p>{t('library.remove.kept')}</p>
      </ConfirmAction>

      {projectDialog ? <AddToProjectDialog open item={item} onClose={() => setProjectDialog(false)} /> : null}
    </article>
  )
}
