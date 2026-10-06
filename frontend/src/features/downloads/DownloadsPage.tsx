import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { invalidate } from '@/api/invalidate'
import { asExportState, type ExportJob } from '@/api/schemas/exports'
import { useQueryParams } from '@/hooks/useQueryParams'
import { exportCode } from './downloadsModel'
import { JobsView } from './JobsView'
import { ManifestView } from './ManifestView'
import { NewExportView } from './NewExportView'

/**
 * Screen 12. Three views of one page, kept in the address so Back, a reload and a pasted link land where the
 * researcher was:  (list)  ·  ?view=new[&scope=projects&projects=12,13]  ·  ?view=manifest&job=7
 * Moving between views adds a history entry; paging the list does not.
 */
export function DownloadsPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const url = useQueryParams()
  // A one-off message after an export starts. It is feedback, not view state, so it stays local and is gone on reload.
  const [notice, setNotice] = useState<string | null>(null)

  const view = url.oneOf('view', ['list', 'new', 'manifest'] as const, 'list')
  const job = url.id('job')
  const toList = () => url.replaceAll({}, { push: true })

  if (view === 'new') {
    const projectIds = url
      .text('projects')
      .split(',')
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0)
    const scope = url.oneOf('scope', ['account', 'projects'] as const, 'account')
    return (
      <NewExportView
        // A different starting scope (from "Start it again") mounts a fresh form instead of syncing the old one.
        key={`${scope}:${projectIds.join(',')}`}
        initial={{ scope, projectIds }}
        onBack={toList}
        onStarted={(started: ExportJob) => {
          void invalidate.exportsChanged(qc)
          const state = asExportState(started.status)
          setNotice(t('downloads.new.started', { code: exportCode(started.id), state: t(`downloads.state.${state}`).toLowerCase() }))
          toList()
        }}
      />
    )
  }

  if (view === 'manifest' && job) {
    return <ManifestView id={job} onBack={toList} />
  }

  return (
    <JobsView
      notice={notice}
      page={url.page}
      onPage={(page) => url.set({ page: page > 1 ? page : null }, { keepPage: true })}
      onNew={() => {
        setNotice(null)
        url.replaceAll({ view: 'new' }, { push: true })
      }}
      onManifest={(id) => url.replaceAll({ view: 'manifest', job: id }, { push: true })}
      onAgain={(source) =>
        url.replaceAll(
          source.scope === 'account'
            ? { view: 'new', scope: 'account' }
            : { view: 'new', scope: 'projects', projects: source.target_id ? String(source.target_id) : null },
          { push: true },
        )
      }
    />
  )
}
