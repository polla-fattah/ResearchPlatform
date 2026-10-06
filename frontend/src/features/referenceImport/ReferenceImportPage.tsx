import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { errorMessage } from '@/api/errorMessage'
import { importReferences, importTag, type EntryOutcome } from '@/api/referenceImport'
import { invalidate } from '@/api/invalidate'
import { BidiText } from '@/components/BidiText'
import { Button, ButtonLink } from '@/components/Button'
import { Field } from '@/components/Field'
import { MutationNotice } from '@/components/MutationNotice'
import { parseReferences } from './parseReferences'
import styles from './ReferenceImport.module.css'

const MAX_BYTES = 2 * 1024 * 1024
/** One call per entry, so a very long list is split by the person rather than left running for minutes. */
const MAX_ENTRIES = 200

/** The day of the import, as YYYY-MM-DD. Read when the import starts, not while the page is drawn. */
const today = (): string => new Date().toISOString().slice(0, 10) // audit-ok: only called when the import starts

const readText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })

/**
 * Screen 36. References from a reference manager (a BibTeX or RIS file) are read here in the browser, shown for a check,
 * and saved to the person's own library one by one. Existing items are never overwritten. Uploading files (scans, data)
 * has no endpoint on the server and is shown as not available (request file C-43).
 */
export function ReferenceImportPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  // The text of the file or the paste, and which entries the person has switched off. Both are the person's typing.
  const [source, setSource] = useState<{ name: string | null; text: string }>({ name: null, text: '' })
  const [skipped, setSkipped] = useState<ReadonlySet<number>>(new Set())
  const [readError, setReadError] = useState<string | null>(null)

  const parsed = useMemo(() => parseReferences(source.text), [source.text])
  const entries = parsed.ok ? parsed.entries : []
  const tooMany = entries.length > MAX_ENTRIES
  const chosen = entries.filter((e, i) => e.problems.length === 0 && !skipped.has(i))

  const run = useMutation({
    mutationFn: () => importReferences(chosen, importTag(today())),
    onSuccess: () => invalidate.libraryChanged(qc),
  })
  const outcomes = run.data ?? []
  const count = (kind: EntryOutcome['kind']) => outcomes.filter((o) => o.kind === kind).length

  const setText = (name: string | null, text: string) => {
    run.reset()
    setSkipped(new Set())
    setSource({ name, text })
  }
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_BYTES) {
      setReadError(t('referenceImport.tooBig', { max: '2 MB' }))
      return
    }
    setReadError(null)
    try {
      setText(file.name, await readText(file))
    } catch {
      setReadError(t('referenceImport.readFailed'))
    }
  }

  return (
    <section aria-label={t('referenceImport.title')}>
      <p>
        <Link to="/library">{t('referenceImport.back')}</Link>
      </p>
      <h1>{t('referenceImport.title')}</h1>
      <p>{t('referenceImport.sub')}</p>

      <section className={styles.section} aria-labelledby="refs-h">
        <h2 id="refs-h">{t('referenceImport.refs.title')}</h2>
        <p className={styles.meta}>{t('referenceImport.refs.note')}</p>
        <Field label={t('referenceImport.refs.file')} requirement="optional" hint={t('referenceImport.refs.fileHint')} error={readError ?? undefined}>
          <input type="file" accept=".bib,.bibtex,.ris,.txt,text/plain" onChange={(e) => void onFile(e)} />
        </Field>
        <Field label={t('referenceImport.refs.paste')} requirement="optional" hint={t('referenceImport.refs.pasteHint')}>
          <textarea rows={6} dir="ltr" value={source.text} onChange={(e) => setText(null, e.target.value)} />
        </Field>

        {!parsed.ok && parsed.reason === 'unreadable' ? (
          <div role="alert" className={styles.note}>
            <p>
              <strong>{t('referenceImport.unreadable.title')}</strong> {t('referenceImport.unreadable.body', { line: parsed.firstLine })}
            </p>
          </div>
        ) : null}
        {!parsed.ok && parsed.reason === 'noEntries' ? <p role="alert">{t('referenceImport.noEntries')}</p> : null}

        {parsed.ok ? (
          <>
            <p role="status">
              {t('referenceImport.found', { count: entries.length, format: t(`referenceImport.format.${parsed.format}`) })}
              {source.name ? ` · ${source.name}` : ''}
            </p>
            {tooMany ? <p role="alert">{t('referenceImport.tooMany', { count: entries.length, max: MAX_ENTRIES })}</p> : null}
            <table className={styles.table}>
              <caption className="sr-only">{t('referenceImport.preview')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('referenceImport.col.import')}</th>
                  <th scope="col">{t('referenceImport.col.line')}</th>
                  <th scope="col">{t('referenceImport.col.entry')}</th>
                  <th scope="col">{t('referenceImport.col.check')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={`${e.line}-${i}`}>
                    <td>
                      <input
                        type="checkbox"
                        checked={e.problems.length === 0 && !skipped.has(i)}
                        disabled={e.problems.length > 0 || run.isPending}
                        aria-label={t('referenceImport.include', { title: e.title || t('referenceImport.untitled') })}
                        onChange={() => setSkipped((cur) => (cur.has(i) ? new Set([...cur].filter((x) => x !== i)) : new Set(cur).add(i)))}
                      />
                    </td>
                    <td>{e.line}</td>
                    <td>
                      {e.title ? <BidiText>{e.title}</BidiText> : <em>{t('referenceImport.untitled')}</em>}
                      <br />
                      <small className={styles.meta}>
                        {e.author ? <BidiText>{e.author}</BidiText> : t('referenceImport.noAuthor')}
                        {e.year ? ` · ${e.year}` : ''}
                        {e.type ? ` · ${e.type}` : ''}
                      </small>
                    </td>
                    <td>{e.problems.includes('noTitle') ? t('referenceImport.problems.noTitle') : t('referenceImport.ok')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.meta}>{t('referenceImport.neverOverwrites')}</p>
            <Button variant="primary" disabled={chosen.length === 0 || tooMany || run.isPending} onClick={() => run.mutate()}>
              {t('referenceImport.import', { count: chosen.length })}
            </Button>
          </>
        ) : null}
        <MutationNotice error={run.error} title={t('referenceImport.failed')} />

        {run.data ? (
          <div role="status" className={styles.detail} aria-label={t('referenceImport.result.title')}>
            <h3>{t('referenceImport.result.title')}</h3>
            <ul>
              <li>{t('referenceImport.result.saved', { count: count('saved') })}</li>
              <li>{t('referenceImport.result.duplicate', { count: count('duplicate') })}</li>
              <li>{t('referenceImport.result.failed', { count: count('failed') })}</li>
            </ul>
            {outcomes.filter((o) => o.kind !== 'saved').length > 0 ? (
              <ul aria-label={t('referenceImport.result.notSaved')}>
                {outcomes
                  .filter((o) => o.kind !== 'saved')
                  .map((o, i) => (
                    <li key={i}>
                      <BidiText>{o.entry.title}</BidiText> ({t('referenceImport.result.line', { line: o.entry.line })}):{' '}
                      {o.kind === 'duplicate' ? t('referenceImport.result.alreadyThere') : errorMessage(o.kind === 'failed' ? o.error : null, t)}
                    </li>
                  ))}
              </ul>
            ) : null}
            <p className={styles.meta}>{t('referenceImport.result.tagged')}</p>
            <ButtonLink to="/library">{t('referenceImport.result.open')}</ButtonLink>
          </div>
        ) : null}
      </section>

      <section className={styles.section} aria-labelledby="up-h">
        <h2 id="up-h">{t('referenceImport.uploads.title')}</h2>
        <p className={styles.note} role="note">
          {t('referenceImport.uploads.unavailable')}
        </p>
      </section>
    </section>
  )
}
