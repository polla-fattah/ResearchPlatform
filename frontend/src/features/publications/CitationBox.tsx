import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getCitation } from '@/api/publications'
import { qk } from '@/api/queryKeys'
import { CITATION_FORMATS, type CitationFormat } from '@/api/schemas/publication'
import { Button } from '@/components/Button'
import styles from '@/features/publicAnnouncements/Public.module.css'

/**
 * "Cite this": the server's formatted citation in the format asked for. The server's route may ignore the format and
 * answer BibTeX; the box says which format it got, so it never labels BibTeX as something else.
 */
export function CitationBox({ slug }: { slug: string }) {
  const { t } = useTranslation()
  const [format, setFormat] = useState<CitationFormat>('bibtex')
  const [copied, setCopied] = useState(false)
  const cite = useQuery({ queryKey: qk.public.citation(slug, format), queryFn: ({ signal }) => getCitation(slug, format, signal), retry: false })
  const got = cite.data?.format?.toLowerCase()
  const mismatch = !!got && got !== format

  return (
    <section className={styles.aside} aria-label={t('publications.cite.title')}>
      <h2>{t('publications.cite.title')}</h2>
      <label>
        {t('publications.cite.format')}{' '}
        <select value={format} onChange={(e) => { setFormat(e.target.value as CitationFormat); setCopied(false) }}>
          {CITATION_FORMATS.map((f) => (
            <option key={f} value={f}>
              {t(`publications.cite.formats.${f}`)}
            </option>
          ))}
        </select>
      </label>
      {cite.isPending ? <p className={styles.meta}>{t('states.loading.label')}</p> : null}
      {cite.isError ? (
        <div role="alert">
          <p>{t('publications.cite.failed')}</p>
          <Button onClick={() => void cite.refetch()}>{t('common.retry')}</Button>
        </div>
      ) : null}
      {cite.data ? (
        <>
          {mismatch ? <p className={styles.meta}>{t('publications.cite.otherFormat', { format: t(`publications.cite.formats.${got as CitationFormat}`, { defaultValue: got }) })}</p> : null}
          <pre dir="ltr" tabIndex={0} aria-label={t('publications.cite.text')} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {cite.data.citation}
          </pre>
          <Button
            onClick={() => {
              navigator.clipboard?.writeText(cite.data!.citation).then(() => setCopied(true), () => undefined)
            }}
          >
            {copied ? t('publications.cite.copied') : t('publications.cite.copy')}
          </Button>
        </>
      ) : null}
    </section>
  )
}
