import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { getPublication } from '@/api/publications'
import { qk } from '@/api/queryKeys'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { MarkdownPreview } from '@/features/writing/MarkdownPreview'
import { CitationBox } from './CitationBox'
import { authorsOf, finishedReviewCount, isRegisteredDoi, noticeOf } from './publicationModel'
import styles from '@/features/publicAnnouncements/Public.module.css'

/**
 * Screen 24. A released publication, open to everyone: the text of the frozen package (documents and findings, with the
 * limitations written or a plain "none"), what was released and when, the licence, a citation, corrections, and a
 * retraction notice when there is one (the text stays, marked). It shows nothing of the project but its title and scope,
 * and no reviewer: only how many reviews were finished.
 */
export function PublicationPage() {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const { slug = '' } = useParams()
  const query = useQuery({ queryKey: qk.public.publication(slug), queryFn: ({ signal }) => getPublication(slug, signal), retry: false })
  const p = query.data
  const notice = p ? noticeOf(p) : null
  const names = p ? authorsOf(p) : []
  const reviews = p ? finishedReviewCount(p) : 0
  const content = p?.published_content

  return (
    <div className={styles.page}>
      <StateBoundary
        state={viewStateOf(query)}
        errorValue={query.error}
        onRetry={() => void query.refetch()}
        forbidden={
          <div className={styles.empty}>
            <h1>{t('publications.gone.title')}</h1>
            <p>{t('publications.gone.body')}</p>
            <Link to="/research">{t('publications.gone.browse')}</Link>
          </div>
        }
      >
        {p ? (
          <article>
            {notice === 'retracted' ? (
              <p className={styles.banner} role="alert">
                <strong>{t('publications.retracted.title', { date: p.retracted_at ? date(p.retracted_at) : '' })}</strong>{' '}
                {p.retraction_reason ? <BidiText>{p.retraction_reason}</BidiText> : null} {t('publications.retracted.note')}
              </p>
            ) : null}
            {notice === 'corrected' ? (
              <section className={styles.banner} aria-label={t('publications.corrected.title', { version: p.version_string ?? '' })}>
                <strong>{t('publications.corrected.title', { version: p.version_string ?? '' })}</strong>
                <ul>
                  {(p.corrigenda ?? []).map((c, i) => (
                    <li key={c.id ?? i}>
                      {c.new_version ? <strong>{c.new_version}</strong> : null} <BidiText>{c.notice ?? ''}</BidiText>
                      {c.created_at ? <span className={styles.meta}> · {date(c.created_at)}</span> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <p className={styles.tag}>{t('publications.tag')}</p>
            <h1>
              <BidiText>{p.title}</BidiText>
            </h1>
            {names.length > 0 ? (
              <p>
                <BidiText>{names.join(' · ')}</BidiText>
                {p.project?.owner?.affiliation ? <span className={styles.meta}> · <BidiText>{p.project.owner.affiliation}</BidiText></span> : null}
              </p>
            ) : null}

            {p.abstract ? (
              <section aria-label={t('publications.abstract')}>
                <h2>{t('publications.abstract')}</h2>
                <p className={styles.summary}>
                  <BidiText>{p.abstract}</BidiText>
                </p>
              </section>
            ) : null}

            {(content?.documents ?? []).map((d, di) => (
              <section key={d.id ?? di} aria-label={d.title}>
                <h2>
                  <BidiText>{d.title}</BidiText>
                </h2>
                <MarkdownPreview headingOffset={2} text={d.latest_version?.content ?? ''} empty={t('publications.noContent')} />
              </section>
            ))}

            {(content?.findings ?? []).length > 0 ? (
              <section aria-label={t('publications.findings')}>
                <h2>{t('publications.findings')}</h2>
                {(content?.findings ?? []).map((f, fi) => (
                  <div key={f.id ?? fi}>
                    <p>
                      <strong>
                        <BidiText>{f.claim}</BidiText>
                      </strong>
                      {f.status ? <span className={styles.meta}> · {t(`review.package.findingStatus.${f.status}`, { defaultValue: f.status })}</span> : null}
                    </p>
                    {f.reasoning ? (
                      <p>
                        <BidiText>{f.reasoning}</BidiText>
                      </p>
                    ) : null}
                    <p className={styles.meta}>{f.limitations ? <><strong>{t('review.package.limitations')}:</strong> <BidiText>{f.limitations}</BidiText></> : t('review.package.noLimitations')}</p>
                  </div>
                ))}
              </section>
            ) : null}

            <section className={styles.aside} aria-label={t('publications.about')}>
              <h2>{t('publications.about')}</h2>
              <dl className={styles.facts}>
                {p.released_at ? (
                  <>
                    <dt>{t('publications.releasedLabel')}</dt>
                    <dd>{date(p.released_at)}</dd>
                  </>
                ) : null}
                {p.version_string ? (
                  <>
                    <dt>{t('publications.versionLabel')}</dt>
                    <dd>{p.version_string}</dd>
                  </>
                ) : null}
                {p.license ? (
                  <>
                    <dt>{t('publications.licence')}</dt>
                    <dd>{p.license}</dd>
                  </>
                ) : null}
                {p.doi ? (
                  <>
                    <dt>{isRegisteredDoi(p.doi) ? t('publications.doi') : t('publications.internalId')}</dt>
                    <dd dir="ltr">{isRegisteredDoi(p.doi) ? <a href={`https://doi.org/${p.doi}`}>{p.doi}</a> : p.doi}</dd>
                  </>
                ) : null}
                <dt>{t('publications.review')}</dt>
                <dd>{reviews > 0 ? t('publications.reviewedBy', { count: reviews }) : t('publications.reviewNone')}</dd>
              </dl>
              {p.project?.title ? (
                <p className={styles.meta}>
                  {t('publications.fromProject')} <BidiText>{p.project.title}</BidiText>
                </p>
              ) : null}
            </section>

            <CitationBox slug={p.public_slug} />

            <p className={styles.foot}>{t('publications.foot')}</p>
            <p>
              <Link to="/research">{t('publications.gone.browse')}</Link>
            </p>
          </article>
        ) : null}
      </StateBoundary>
    </div>
  )
}
