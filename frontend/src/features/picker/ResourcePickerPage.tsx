import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { attachResourceToProject, listLibraryItems, saveLibraryItem } from '@/api/library'
import type { LibraryItem, SaveLibraryInput } from '@/api/schemas/library'
import { usePreferences } from '@/app/preferencesContext'
import { Button, ButtonLink } from '@/components/Button'
import { ErrorSummary } from '@/components/Field'
import { formatCode } from '@/domain/codes'
import {
  emptyExternalReference,
  missingParts,
  toSaveInput,
  type ExternalReferenceForm,
} from '@/domain/externalReference'
import { pickableSavedKey } from '@/domain/pickable'
import { useProject } from '@/features/projects/useProject'
import { CorpusPicker } from './CorpusPicker'
import { emptySelection, type PickerSelection } from './selection'
import { ExternalForm } from './ExternalForm'
import styles from './Picker.module.css'
import { qk } from '@/api/queryKeys'
import { invalidate } from '@/api/invalidate'
import { useQueryParams } from '@/hooks/useQueryParams'
import { errorMessage } from '@/api/errorMessage'

type Tab = 'corpus' | 'external'
type Destination = 'library' | 'project'
type DupChoice = 'reuse' | 'distinct' | null

const todayIso = () => new Date().toISOString().slice(0, 10) // audit-ok: called from an initialiser and a handler only

interface Done {
  title: string
  reused: boolean
  projectId: number | null
}

/**
 * Screen 07. Opened from My Library (/library/add) or from a project's Resources
 * (/projects/:id/resources/add). Saves corpus items or external references to My Library,
 * and optionally to the project too.
 */
export function ResourcePickerPage() {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const qc = useQueryClient()
  const { projectId: rawProjectId } = useParams()
  const projectId = rawProjectId ? Number(rawProjectId) : null
  const { project, can } = useProject()

  // A project can take resources only when you may add shared content and it is not archived.
  const projectWritable = projectId !== null && !!project && can('addShared') && !project.is_archived && !project.is_deleted

  const url = useQueryParams()
  const tab: Tab = url.oneOf('tab', ['corpus', 'external'] as const, 'corpus')
  const setTab = (next: Tab) => url.set({ tab: next === 'corpus' ? null : next })
  const [dest, setDest] = useState<Destination>(projectId !== null ? 'project' : 'library')
  const [selection, setSelection] = useState<PickerSelection>(emptySelection)
  const [external, setExternal] = useState<ExternalReferenceForm>(() => emptyExternalReference(todayIso()))
  const [dupFromServer, setDupFromServer] = useState<LibraryItem | null>(null)
  const [choice, setChoice] = useState<DupChoice>(null)
  const [done, setDone] = useState<Done | null>(null)

  const library = useQuery({ queryKey: qk.library.index, queryFn: ({ signal }) => listLibraryItems(signal) })
  const saved = useMemo(() => {
    const map = new Map<string, LibraryItem>()
    for (const it of library.data ?? []) {
      const key = it.resource.corpus_table && it.resource.corpus_id ? `${it.resource.corpus_table}:${it.resource.corpus_id}` : null
      if (key && !map.has(key)) map.set(key, it)
    }
    return map
  }, [library.data])

  const effectiveDest: Destination = dest === 'project' && projectWritable ? 'project' : 'library'
  const item = selection.item
  const isCorpus = tab === 'corpus'

  // The existing library entry for what is selected: known up front, or learned from a 409.
  const existing: LibraryItem | null = isCorpus
    ? ((item && saved.get(pickableSavedKey(item) ?? '')) || dupFromServer)
    : dupFromServer

  const input = (allowDuplicate: boolean): SaveLibraryInput | null => {
    if (isCorpus) {
      if (!item) return null
      const base: SaveLibraryInput = {
        ...item.save,
        locator: item.locator,
        incomplete_citation_flags: item.gaps,
        allow_duplicate_excerpt: allowDuplicate || undefined,
      }
      if (selection.mode === 'span' && selection.span) {
        return { ...base, excerpt_text: selection.span, locator: `${item.locator} · selected passage` }
      }
      if (selection.mode === 'page' && selection.pages.trim()) {
        return { ...base, locator: `${item.locator} · pp. ${selection.pages.trim()}` }
      }
      return base
    }
    return { ...toSaveInput(external), allow_duplicate_excerpt: allowDuplicate || undefined }
  }

  const distinctReady = selection.mode === 'span' ? !!selection.span : selection.mode === 'page' ? !!selection.pages.trim() : false

  const save = useMutation({
    mutationFn: async (): Promise<Done | 'duplicate'> => {
      const title = isCorpus ? (item?.title ?? '') : external.title.trim()
      let resourceId: number

      if (existing && choice === 'reuse') {
        resourceId = existing.resource_id
      } else {
        const body = input(existing !== null && choice === 'distinct')
        if (!body) throw new Error('nothing selected')
        const outcome = await saveLibraryItem(body)
        if (outcome.kind === 'duplicate') {
          setDupFromServer(outcome.existing)
          return 'duplicate'
        }
        resourceId = outcome.item.resource_id
      }

      if (effectiveDest === 'project' && projectId !== null) {
        await attachResourceToProject(projectId, resourceId)
      }
      return { title, reused: choice === 'reuse', projectId: effectiveDest === 'project' ? projectId : null }
    },
    onSuccess: (result) => {
      if (result === 'duplicate') return
      setDone(result)
      void invalidate.libraryChanged(qc)
      if (result.projectId !== null) void invalidate.resourcesChanged(qc, result.projectId)
    },
  })

  const reset = () => {
    setDone(null)
    setSelection(emptySelection)
    setExternal(emptyExternalReference(todayIso()))
    setDupFromServer(null)
    setChoice(null)
    save.reset()
  }

  const origin = projectId !== null ? t('picker.originProject', { code: formatCode('PRJ', projectId) }) : t('picker.originLibrary')
  const closeTo = projectId !== null ? `/projects/${projectId}/resources` : '/library'
  const destLabel = effectiveDest === 'project' && projectId !== null
    ? t('picker.saveTo.project', { code: formatCode('PRJ', projectId) })
    : t('picker.saveTo.library')

  if (done) {
    return (
      <section>
        <div className={styles.done} role="status">
          <h1 style={{ margin: 0 }}>{t('picker.done.title')}</h1>
          <p style={{ margin: 0 }}>
            {done.reused
              ? t('picker.duplicate.reusedDone')
              : done.projectId !== null
                ? t('picker.done.toProject', { title: done.title, code: formatCode('PRJ', done.projectId) })
                : t('picker.done.toLibrary', { title: done.title })}
          </p>
          <div className={styles.footerActions}>
            <Button onClick={reset}>{t('picker.done.another')}</Button>
            <ButtonLink to="/library">{t('picker.done.openLibrary')}</ButtonLink>
            {done.projectId !== null ? (
              <ButtonLink variant="primary" to={`/projects/${done.projectId}/resources`}>
                {t('picker.done.openProject')}
              </ButtonLink>
            ) : null}
          </div>
        </div>
      </section>
    )
  }

  const gaps = isCorpus ? (item?.gaps.length ?? 0) : missingParts(external).length
  const externalBlocked = !isCorpus && !external.title.trim()
  const needsChoice = existing !== null
  const choiceBlocked = needsChoice && (choice === null || (choice === 'distinct' && !distinctReady))
  const saveDisabled = save.isPending || (isCorpus ? !item : externalBlocked) || choiceBlocked

  let footerLine: string
  if (isCorpus) {
    footerLine = item ? t('picker.footer.route', { code: item.code, dest: destLabel }) : t('picker.footer.nothing')
  } else if (externalBlocked) footerLine = t('picker.footer.needTitle')
  else if (gaps > 0) footerLine = t('picker.footer.flagged', { count: gaps })
  else footerLine = t('picker.footer.ready')

  const saveLabel = save.isPending
    ? t('picker.footer.saving')
    : needsChoice
      ? t('picker.footer.continue')
      : isCorpus
        ? t('picker.footer.save')
        : gaps > 0
          ? t('picker.footer.saveWithFlag')
          : t('picker.footer.saveReference')

  const duplicate = existing ? (
    <div className={styles.dup} role="group" aria-label={t('picker.duplicate.title')}>
      <h3>{t('picker.duplicate.title')}</h3>
      <p style={{ margin: 0 }}>
        {t('picker.duplicate.body', {
          when: existing.created_at ? date(existing.created_at) : t('common.unknown'),
          as: existing.locator
            ? t('picker.duplicate.asExcerpt', { locator: existing.locator })
            : '',
        })}
      </p>
      <label className={[styles.choice, choice === 'reuse' ? styles.choiceOn : ''].join(' ')}>
        <input type="radio" name="dup" checked={choice === 'reuse'} onChange={() => setChoice('reuse')} />
        <span>{t('picker.duplicate.reuse')}</span>
      </label>
      <label className={[styles.choice, choice === 'distinct' ? styles.choiceOn : ''].join(' ')}>
        <input type="radio" name="dup" checked={choice === 'distinct'} onChange={() => setChoice('distinct')} />
        <span>
          {t('picker.duplicate.distinct')}
          {choice === 'distinct' && !distinctReady ? <small>{t('picker.duplicate.distinctNeeded')}</small> : null}
        </span>
      </label>
    </div>
  ) : null

  const failure = save.isError ? errorMessage(save.error, t) : null

  return (
    <section>
      <div className={styles.head}>
        <div>
          <h1>{t('picker.title')}</h1>
          <p className={styles.origin}>{t('picker.openedFrom', { origin })}</p>
        </div>
        <ButtonLink to={closeTo}>{t('picker.close')}</ButtonLink>
      </div>

      {projectId !== null && !projectWritable && project ? (
        <div className={styles.forbidden} role="status">
          <h2>{t('picker.forbiddenTitle')}</h2>
          <p>{t('picker.forbiddenBody')}</p>
          <Button onClick={() => setDest('library')}>{t('picker.saveToLibraryInstead')}</Button>
        </div>
      ) : null}

      <div className={styles.tabs} role="tablist">
        {(['corpus', 'external'] as const).map((k) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={tab === k}
            className={[styles.tab, tab === k ? styles.tabActive : ''].join(' ')}
            onClick={() => {
              setTab(k)
              setDupFromServer(null)
              setChoice(null)
            }}
          >
            {t(`picker.tabs.${k}`)}
          </button>
        ))}
      </div>

      {tab === 'corpus' ? (
        <CorpusPicker
          value={selection}
          onChange={(next) => {
            if (next.item?.key !== selection.item?.key) {
              setDupFromServer(null)
              setChoice(null)
            }
            setSelection(next)
          }}
          saved={saved}
          duplicate={duplicate}
          onAddExternal={() => setTab('external')}
          disabled={save.isPending}
        />
      ) : (
        <>
          <ExternalForm value={external} onChange={setExternal} disabled={save.isPending} />
          {duplicate ? <div style={{ marginBlockStart: '1rem', maxInlineSize: '44rem' }}>{duplicate}</div> : null}
        </>
      )}

      <fieldset className={styles.dest} style={{ border: 0, padding: 0, marginBlockStart: '1.5rem' }}>
        <legend style={{ fontWeight: 500, marginBlockEnd: '0.5rem' }}>{t('picker.saveTo.title')}</legend>
        <label className={[styles.destOption, effectiveDest === 'library' ? styles.destOn : ''].join(' ')}>
          <input type="radio" name="dest" checked={effectiveDest === 'library'} onChange={() => setDest('library')} />
          <span>
            {t('picker.saveTo.library')} <span className="mono">🔒 {t('picker.saveTo.libraryBadge')}</span>
            <small>{t('picker.saveTo.librarySub')}</small>
          </span>
        </label>
        {projectId !== null ? (
          <label
            className={[
              styles.destOption,
              effectiveDest === 'project' ? styles.destOn : '',
              projectWritable ? '' : styles.destDisabled,
            ].join(' ')}
          >
            <input
              type="radio"
              name="dest"
              checked={effectiveDest === 'project'}
              disabled={!projectWritable}
              onChange={() => setDest('project')}
            />
            <span>
              {t('picker.saveTo.project', { code: formatCode('PRJ', projectId) })}{' '}
              <span className="mono">{t('picker.saveTo.projectBadge')}</span>
              <small>{t('picker.saveTo.projectSub')}</small>
            </span>
          </label>
        ) : null}
      </fieldset>

      {failure ? (
        <div style={{ marginBlockStart: '1rem' }}>
          <ErrorSummary title={t('picker.failedTitle')} items={[failure]} footer={t('picker.failedKept')} />
        </div>
      ) : null}

      <div className={styles.footer}>
        <span className={styles.footerLine}>{footerLine}</span>
        <span className={styles.footerActions}>
          <ButtonLink to={closeTo}>{t('picker.footer.cancel')}</ButtonLink>
          <Button variant="primary" disabled={saveDisabled} onClick={() => save.mutate()}>
            {saveLabel}
          </Button>
        </span>
      </div>
    </section>
  )
}
