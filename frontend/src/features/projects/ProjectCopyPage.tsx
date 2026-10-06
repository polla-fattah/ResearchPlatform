import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { userMessage } from '@/api/errors'

import {
  copyItems,
  copyPreview,
  listCopyableResources,
  listCopyableSearches,
  projectDetailKeys,
} from '@/api/projectDetail'
import { listProjects, projectKeys } from '@/api/projects'
import type { CopyItem } from '@/api/schemas/projectDetail'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { ErrorSummary, Field, Notice } from '@/components/Field'
import { formatCode } from '@/domain/codes'
import styles from './Projects.module.css'
import { useProject } from './useProject'

type Key = `${CopyItem['type']}:${number}`
const keyOf = (type: CopyItem['type'], id: number): Key => `${type}:${id}`

/** Screen 06, "Copy to another project". Membership, private notes and publication authority never travel. */
export function ProjectCopyPage() {
  const { t } = useTranslation()
  const { id, project } = useProject()
  const [target, setTarget] = useState('')
  const [selected, setSelected] = useState<Set<Key>>(new Set())

  const destinations = useQuery({
    queryKey: projectKeys.list({ scope: 'owned', per_page: 100 }),
    queryFn: ({ signal }) => listProjects({ scope: 'owned', per_page: 100 }, signal),
  })
  const resources = useQuery({
    queryKey: projectDetailKeys.picker(id ?? 0, 'resources'),
    queryFn: ({ signal }) => listCopyableResources(id!, signal),
    enabled: id !== null,
  })
  const searches = useQuery({
    queryKey: projectDetailKeys.picker(id ?? 0, 'searches'),
    queryFn: ({ signal }) => listCopyableSearches(id!, signal),
    enabled: id !== null,
  })

  const choices = (destinations.data?.items ?? []).filter((p) => p.id !== id)
  const targetId = Number(target) || null
  const items: CopyItem[] = useMemo(
    () =>
      [...selected].map((k) => {
        const [type, rawId] = k.split(':')
        return { type: type as CopyItem['type'], id: Number(rawId) }
      }),
    [selected],
  )
  const labelOf = (i: CopyItem) => {
    const list = i.type === 'resource' ? resources.data : searches.data
    const row = list?.find((r) => r.id === i.id)
    return row?.title ?? row?.name ?? `#${i.id}`
  }

  const preview = useQuery({
    queryKey: ['projects', 'copy-preview', id, targetId, items],
    queryFn: () => copyPreview(id!, targetId!, items),
    enabled: id !== null && targetId !== null && items.length > 0,
    retry: false,
  })
  const run = useMutation({ mutationFn: () => copyItems(id!, targetId!, items) })

  if (!project || id === null) return null
  const toggle = (k: Key) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })

  if (run.isSuccess) {
    const done = new Set(run.data.filter((r) => r.status === 'copied').map((r) => keyOf(r.type as CopyItem['type'], r.id)))
    return (
      <section className={styles.formCard}>
        <h1 style={{ margin: 0 }}>{t('projects.copy.result', { done: done.size, total: items.length })}</h1>
        <ul className={styles.groupList}>
          {items.map((i) => {
            const ok = done.has(keyOf(i.type, i.id))
            return (
              <li key={keyOf(i.type, i.id)}>
                {ok ? '✓ ' : '✕ '}
                {ok
                  ? t('projects.copy.copied', { label: labelOf(i) })
                  : t('projects.copy.notCopied', { label: labelOf(i) })}
              </li>
            )
          })}
        </ul>
        <p>
          <Link to={`/projects/${targetId}/overview`}>{formatCode('PRJ', targetId ?? 0)} →</Link>
        </p>
      </section>
    )
  }

  const group = (
    heading: string,
    type: CopyItem['type'],
    rows: { id: number; title?: string; name?: string }[] | undefined,
    disabled?: string,
  ) => (
    <div>
      <h3 style={{ margin: '0 0 0.25rem' }}>{heading}</h3>
      {disabled ? (
        <p className={styles.meta}>{disabled}</p>
      ) : !rows || rows.length === 0 ? (
        <p className={styles.meta}>{t('projects.copy.none')}</p>
      ) : (
        <ul className={styles.groupList}>
          {rows.map((r) => (
            <li key={r.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.has(keyOf(type, r.id))}
                  onChange={() => toggle(keyOf(type, r.id))}
                />{' '}
                <BidiText>{r.title ?? r.name ?? `#${r.id}`}</BidiText>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  return (
    <section className={styles.formCard}>
      <div>
        <p className="mono" style={{ margin: 0 }}>
          {t('projects.copy.from', { code: formatCode('PRJ', id) })}
        </p>
        <h1 style={{ margin: 0 }}>{t('projects.copy.title')}</h1>
      </div>

      {run.isError ? (
        <ErrorSummary
          title={t('projects.copy.failed')}
          items={[userMessage(run.error, t('states.error.body'))]}
        />
      ) : null}

      {destinations.isSuccess && choices.length === 0 ? (
        <Notice dashed>{t('projects.copy.noDestination')}</Notice>
      ) : (
        <Field label={t('projects.copy.destination')}>
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">{t('projects.copy.choose')}</option>
            {choices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} · {formatCode('PRJ', p.id)}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className={styles.copyGroups}>
        <h2 style={{ margin: 0 }}>{t('projects.copy.what')}</h2>
        {group(t('projects.copy.resources'), 'resource', resources.data)}
        {group(t('projects.copy.searches'), 'saved_query', searches.data)}
        {group(t('projects.copy.analyses'), 'analysis', [], t('projects.copy.analysesUnavailable'))}
      </div>

      {targetId ? (
        <div className={styles.preview}>
          <strong>{t('projects.copy.visibility', { code: formatCode('PRJ', targetId) })}</strong>
          <p>{t('projects.copy.visibilityBody', { code: formatCode('PRJ', targetId) })}</p>
          {preview.isError ? <p role="alert">{t('projects.copy.previewFailed')}</p> : null}
        </div>
      ) : null}

      <div className={styles.preview}>
        <strong>{t('projects.copy.neverCopied')}</strong>
        <p>{t('projects.copy.neverCopiedList')}</p>
        <p className={styles.meta}>{t('projects.copy.destinationNote')}</p>
      </div>

      <div className={styles.row2}>
        <Button
          variant="primary"
          disabled={run.isPending || items.length === 0 || !targetId}
          onClick={() => run.mutate()}
        >
          {run.isPending ? t('projects.copy.copying') : t('projects.copy.copy', { count: items.length })}
        </Button>
        {items.length === 0 || !targetId ? <span className={styles.meta}>{t('projects.copy.pickSomething')}</span> : null}
      </div>
    </section>
  )
}
