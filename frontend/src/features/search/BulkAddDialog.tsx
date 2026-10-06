import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { saveLibraryItem } from '@/api/library'
import type { CorpusOccurrence, CorpusSearchHit } from '@/api/schemas/corpus'
import { bulkAddEvidence, bulkAddResources, type EvidenceDraft } from '@/api/searchWorkspace'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { formatCode } from '@/domain/codes'
import { pickableFromOccurrence, type Pickable } from '@/domain/pickable'
import styles from './Search.module.css'
import { invalidate } from '@/api/invalidate'
import { MutationNotice } from '@/components/MutationNotice'

export interface Pick {
  hit: CorpusSearchHit
  occ: CorpusOccurrence
}

interface Props {
  kind: 'evidence' | 'resources'
  projectId: number
  picks: Pick[]
  /** The recorded run these results came from, when there is one. */
  runId?: number
  onClose: () => void
  onDone: () => void
}

type Outcome = 'added' | 'skipped' | 'failed'
interface Row {
  title: string
  outcome: Outcome
}

/**
 * Adds the selected occurrences to the project's resources or evidence. The API wants resource ids, and
 * the only way to create a resource is to save the source to My Library, so each occurrence is saved
 * first (a repeat is fine: the existing entry is reused) and then added. Every item gets its own outcome.
 */
export function BulkAddDialog({ kind, projectId, picks, runId, onClose, onDone }: Props) {
  const { t } = useTranslation()
  const { n } = usePreferences()
  const qc = useQueryClient()
  const [rows, setRows] = useState<Row[] | null>(null)
  const code = formatCode('PRJ', projectId)

  const run = useMutation({
    mutationFn: async () => {
      const out: Row[] = []
      const ready: { pick: Pick; pickable: Pickable; resourceId: number }[] = []
      for (const pick of picks) {
        const pickable = pickableFromOccurrence(pick.hit, pick.occ)
        try {
          const saved = await saveLibraryItem({
            ...pickable.save,
            locator: pickable.locator,
            incomplete_citation_flags: pickable.gaps,
          })
          const resourceId = saved.kind === 'saved' ? saved.item.resource_id : saved.existing?.resource_id
          if (resourceId) ready.push({ pick, pickable, resourceId })
          else out.push({ title: pickable.title, outcome: 'failed' })
        } catch {
          out.push({ title: pickable.title, outcome: 'failed' })
        }
      }

      if (ready.length > 0) {
        const result =
          kind === 'resources'
            ? await bulkAddResources(projectId, [...new Set(ready.map((r) => r.resourceId))], runId)
            : await bulkAddEvidence(
                projectId,
                ready.map<EvidenceDraft>((r) => ({
                  resource_id: r.resourceId,
                  captured_text: r.pick.hit.matn ?? '',
                  locator: r.pickable.locator,
                })),
                runId,
              )
        const byResource = new Map<number, string[]>()
        for (const o of result.outcomes) byResource.set(o.resource_id, [...(byResource.get(o.resource_id) ?? []), o.outcome])
        for (const r of ready) {
          const next = byResource.get(r.resourceId)?.shift()
          out.push({ title: r.pickable.title, outcome: next === 'added' ? 'added' : next === 'duplicate_skipped' ? 'skipped' : next ? 'failed' : 'skipped' })
        }
      }
      return out
    },
    onSuccess: (out) => {
      setRows(out)
      void invalidate.libraryChanged(qc)
      void invalidate.resourcesChanged(qc, projectId)
      if (kind === 'evidence') void invalidate.evidenceChanged(qc, projectId)
    },
  })

  const count = (o: Outcome) => rows?.filter((r) => r.outcome === o).length ?? 0
  const title = t(kind === 'evidence' ? 'search.add.titleEvidence' : 'search.add.titleResources', { id: code })

  const close = () => {
    if (rows) onDone()
    onClose()
  }

  return (
    <Modal title={title} onClose={close} wide>
      {rows ? (
        <>
          <p role="status">
            {t('search.add.summary', {
              added: n(count('added')),
              skipped: n(count('skipped')),
              failed: n(count('failed')),
            })}
          </p>
          <ul className={styles.outcomes}>
            {rows.map((r, i) => (
              <li key={i} className={r.outcome === 'failed' ? styles.bad : ''}>
                <span aria-hidden="true">{r.outcome === 'added' ? '✓ ' : r.outcome === 'skipped' ? '＝ ' : '✕ '}</span>
                <BidiText>{r.title}</BidiText>
                {' · '}
                {t(`search.add.${r.outcome}`)}
              </li>
            ))}
          </ul>
          <div className={styles.dialogActions}>
            <Link to={`/projects/${projectId}/${kind === 'evidence' ? 'evidence' : 'resources'}`}>
              {t(kind === 'evidence' ? 'search.add.openEvidence' : 'search.add.openResources')}
            </Link>
            <Button variant="primary" onClick={close}>
              {t('search.add.done')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p>{t('search.add.intro')}</p>
          {kind === 'evidence' ? <p>{t('search.add.evidenceNote')}</p> : null}
          <ul className={styles.outcomes}>
            {picks.map(({ hit, occ }) => {
              const p = pickableFromOccurrence(hit, occ)
              return (
                <li key={occ.id}>
                  <BidiText>{p.title}</BidiText> <span className="mono">{p.code}</span>
                </li>
              )
            })}
          </ul>
          <MutationNotice error={run.error} />
          <div className={styles.dialogActions}>
            <Button onClick={onClose} disabled={run.isPending}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" disabled={run.isPending || picks.length === 0} onClick={() => run.mutate()}>
              {run.isPending
                ? t('search.add.working')
                : t('search.add.submit', { count: picks.length, formattedCount: n(picks.length) })}
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}
