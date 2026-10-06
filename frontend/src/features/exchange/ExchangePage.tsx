import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { exportArgumentGraph } from '@/api/graphExport'
import { BidiText } from '@/components/BidiText'
import { Button, ButtonLink } from '@/components/Button'
import { Field } from '@/components/Field'
import { MutationNotice } from '@/components/MutationNotice'
import { formatCode } from '@/domain/codes'
import { useExportableProjects } from '@/features/downloads/useExportableProjects'
import { useQueryParams } from '@/hooks/useQueryParams'
import { graphFileName } from './exchangeModel'
import styles from './Exchange.module.css'

/**
 * Screen 38. What can be exported and imported beyond the ZIP of screen 12:
 *  - the argument map's structure as a JSON file, which the server really produces;
 *  - a Word document, which the server accepts a request for but does not make (it returns the same ZIP of JSON files);
 *  - importing a package, which the server answers by making an EMPTY project (it reads the title and drops every item).
 * The last two are shown as not available rather than offered, so nobody believes their work was carried over (C-42).
 */
export function ExchangePage() {
  const { t } = useTranslation()
  const url = useQueryParams()
  const { projects, isPending, isError } = useExportableProjects()
  const chosen = url.id('project')
  const project = projects.find((p) => p.id === chosen) ?? null

  const save = useMutation({ mutationFn: (id: number) => exportArgumentGraph(id, graphFileName(id)) })

  return (
    <section aria-label={t('exchange.title')}>
      <p>
        <Link to="/downloads">{t('exchange.back')}</Link>
      </p>
      <h1>{t('exchange.title')}</h1>
      <p>{t('exchange.sub')}</p>

      <section className={styles.section} aria-labelledby="graph-h">
        <h2 id="graph-h">{t('exchange.graph.title')}</h2>
        <p>{t('exchange.graph.what')}</p>
        <p className={styles.meta}>{t('exchange.graph.notIncluded')}</p>
        {isError ? <p role="alert">{t('exchange.graph.projectsFailed')}</p> : null}
        {!isPending && projects.length === 0 && !isError ? <p className={styles.empty}>{t('exchange.graph.noProjects')}</p> : null}
        {projects.length > 0 ? (
          <div className={styles.head}>
            <Field label={t('exchange.graph.project')} requirement="required">
              <select value={chosen ?? ''} onChange={(e) => url.set({ project: e.target.value })}>
                <option value="">{t('exchange.graph.choose')}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {formatCode('PRJ', p.id)} · {p.title}
                  </option>
                ))}
              </select>
            </Field>
            <Button variant="primary" disabled={!project || save.isPending} onClick={() => project && save.mutate(project.id)}>
              {t('exchange.graph.download')}
            </Button>
          </div>
        ) : null}
        {save.data ? (
          <p role="status">
            {t('exchange.graph.saved', { file: graphFileName(save.data.project_id), points: save.data.summary.total_nodes, relations: save.data.summary.total_edges })}
            {project ? (
              <>
                {' '}
                <Link to={`/projects/${project.id}/argument-map`}>
                  <BidiText>{project.title}</BidiText>
                </Link>
              </>
            ) : null}
          </p>
        ) : null}
        <MutationNotice error={save.error} title={t('exchange.graph.failed')} />
      </section>

      <section className={styles.section} aria-labelledby="docx-h">
        <h2 id="docx-h">{t('exchange.docx.title')}</h2>
        <p className={styles.note} role="note">
          {t('exchange.docx.unavailable')}
        </p>
      </section>

      <section className={styles.section} aria-labelledby="import-h">
        <h2 id="import-h">{t('exchange.import.title')}</h2>
        <p className={styles.note} role="note">
          {t('exchange.import.unavailable')}
        </p>
        <p>
          <ButtonLink to="/projects/new">{t('exchange.import.blank')}</ButtonLink>
        </p>
      </section>
    </section>
  )
}
