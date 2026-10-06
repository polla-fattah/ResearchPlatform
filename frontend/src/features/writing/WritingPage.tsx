import { useQueryParams } from '@/hooks/useQueryParams'
import { useProject } from '@/features/projects/useProject'
import { DocumentView } from './DocumentView'
import { FindingView } from './FindingView'
import { IndexView } from './IndexView'

/**
 * Screen 11. One page, three places, all kept in the address so Back, a reload and a pasted link land where the
 * researcher was:  (index)  ·  ?doc=7[&view=versions]  ·  ?finding=4 or ?finding=new
 */
export function WritingPage() {
  const { id: projectId, can } = useProject()
  const url = useQueryParams()
  const canEdit = can('editShared')

  const doc = url.id('doc')
  const findingParam = url.text('finding')
  const finding = findingParam === 'new' ? 'new' : url.id('finding')

  const toIndex = () => url.replaceAll({}, { push: true })
  const openDocument = (id: number) => url.replaceAll({ doc: id }, { push: true })
  const openFinding = (id: number | 'new') => url.replaceAll({ finding: id }, { push: true })

  if (projectId === null) return null

  if (doc) {
    return (
      <DocumentView
        key={doc}
        projectId={projectId}
        id={doc}
        canEdit={canEdit}
        showVersions={url.oneOf('view', ['editor', 'versions'] as const, 'editor') === 'versions'}
        onVersions={(show) => url.set({ view: show ? 'versions' : null }, { push: true, keepPage: true })}
        onBack={toIndex}
        onOpenFinding={openFinding}
      />
    )
  }

  if (finding) {
    return (
      <FindingView
        projectId={projectId}
        id={finding}
        canEdit={canEdit}
        onBack={toIndex}
        onCreated={(id) => url.replaceAll({ finding: id })}
        onOpenDocument={openDocument}
      />
    )
  }

  return <IndexView projectId={projectId} canEdit={canEdit} onOpenDocument={openDocument} onOpenFinding={openFinding} />
}
