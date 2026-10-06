import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { previewCitation } from '@/api/documents'
import { qk } from '@/api/queryKeys'
import type { EvidenceItem } from '@/api/schemas/evidence'
import { NeutralState } from '@/components/Badges'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { evidenceCode } from '../evidence/evidenceModel'
import { citationText, type CiteKind } from './writingModel'
import styles from './Writing.module.css'

interface Props {
  projectId: number
  documentId: number
  evidence: readonly EvidenceItem[]
  onInsert: (text: string) => void
  onClose: () => void
}

const KINDS: CiteKind[] = ['exact', 'paraphrase', 'ref']
const MODE = { exact: 'direct_quotation', paraphrase: 'paraphrase', ref: 'reference' } as const

const excerpt = (s: string) => (s.length > 70 ? `${s.slice(0, 70).trimEnd()}…` : s)

/** Choose evidence and how to cite it, see exactly what will be inserted, and insert it (with its flag if incomplete). */
export function CitationDialog({ projectId, documentId, evidence, onInsert, onClose }: Props) {
  const { t } = useTranslation()
  const [evidenceId, setEvidenceId] = useState<number | null>(null)
  const [kind, setKind] = useState<CiteKind>('exact')
  const chosen = evidence.find((e) => e.id === evidenceId) ?? null

  const preview = useQuery({
    queryKey: qk.project(projectId).documents.citeAs(evidenceId ?? 0, MODE[kind]),
    queryFn: () => previewCitation(projectId, documentId, evidenceId!, MODE[kind]),
    enabled: chosen !== null,
    retry: false,
  })

  const incomplete = chosen ? !chosen.locator?.trim() : false
  const text = chosen ? citationText(evidenceCode(chosen.id), kind, chosen.captured_text) : ''

  const insert = () => {
    if (!chosen) return
    // A quotation is a block of its own in Markdown, so it is set apart by blank lines.
    onInsert(kind === 'exact' ? `\n\n${text}\n\n` : text)
    onClose()
  }

  return (
    <Modal title={t('writing.citation.title')} onClose={onClose} wide>
      {evidence.length === 0 ? (
        <p>{t('writing.citation.none')}</p>
      ) : (
        <div className={styles.dialogForm}>
          <label className={styles.inlineField}>
            <span>{t('writing.citation.evidence')}</span>
            <select value={evidenceId ?? ''} onChange={(e) => setEvidenceId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">{t('writing.citation.pick')}</option>
              {evidence.map((e) => (
                <option key={e.id} value={e.id}>
                  {evidenceCode(e.id)} · {e.resource?.title ?? ''}: {excerpt(e.captured_text)}
                </option>
              ))}
            </select>
          </label>

          <div role="radiogroup" aria-label={t('writing.citation.insertAs')} className={styles.choices}>
            {KINDS.map((k) => (
              <label key={k} className={styles.choice}>
                <input type="radio" name="cite-kind" checked={kind === k} onChange={() => setKind(k)} />
                <span>
                  {t(`writing.citation.modes.${k}`)}
                  <small>{t(`writing.citation.modeSub.${k}`)}</small>
                </span>
              </label>
            ))}
          </div>

          {chosen ? (
            <section className={styles.citePreview} aria-label={t('writing.citation.preview')}>
              <h3>{t('writing.citation.preview')}</h3>
              <p className="mono">{text.replace(/^> /, '')}</p>
              {kind === 'exact' ? (
                <p className={styles.quote}>
                  <BidiText>{chosen.captured_text}</BidiText>
                </p>
              ) : null}
              <dl className={styles.facts}>
                <dt>{t('writing.citation.formatted')}</dt>
                <dd>{preview.data?.formatted_citation ?? (preview.isError ? t('writing.citation.failed') : '…')}</dd>
                {incomplete ? (
                  <>
                    <dt>{t('writing.citation.flags')}</dt>
                    <dd>
                      <NeutralState kind="incompleteCitation" />
                      <span className={styles.hint}> {t('writing.doc.incompleteLocator')}</span>
                    </dd>
                  </>
                ) : null}
              </dl>
              {incomplete ? <p className={styles.hint}>{t('writing.citation.flagNote')}</p> : null}
              <p className={styles.hint}>{t('writing.citation.numbering')}</p>
            </section>
          ) : null}
        </div>
      )}
      <div className={styles.dialogActions}>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" disabled={!chosen} onClick={insert}>
          {incomplete ? t('writing.citation.insertFlag') : t('writing.citation.insert')}
        </Button>
      </div>
    </Modal>
  )
}
