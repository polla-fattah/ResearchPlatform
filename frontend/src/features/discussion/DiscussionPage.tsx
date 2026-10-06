import { useTranslation } from 'react-i18next'
import { NeutralState } from '@/components/Badges'
import { Button } from '@/components/Button'
import { ROLE_LABEL_KEYS } from '@/domain/roles'
import { useProject } from '@/features/projects/useProject'
import { useQueryParams } from '@/hooks/useQueryParams'
import { DiscussionsView } from './DiscussionsView'
import { isTargetType } from './discussionModel'
import { NewThreadDialog, type Target } from './NewThreadDialog'
import { TasksView } from './TasksView'
import styles from './Discussion.module.css'

const VIEWS = ['discussions', 'tasks'] as const

/**
 * Screen 16. The view (discussions or tasks), the open discussion, the filters and whether the "new" dialog is open
 * are all in the address, so a discussion about an item can be opened from that item's own screen with a link:
 * `?new=1&targetType=evidence&targetId=4`. The page itself keeps no state.
 */
export function DiscussionPage() {
  const { t } = useTranslation()
  const { id, role, can } = useProject()
  const url = useQueryParams()
  const view = url.oneOf('view', VIEWS, 'discussions')
  const creating = url.text('new') === '1'
  const type = url.text('targetType')
  const targetId = url.id('targetId')
  const target: Target = isTargetType(type) && targetId ? { type, id: targetId } : { type: 'project', id: id ?? 0 }

  if (id === null || !role) return null
  const closeNew = () => url.set({ new: null, targetType: null, targetId: null }, { keepPage: true })

  return (
    <section>
      <div className={styles.head}>
        <div role="tablist" aria-label={t('discussion.views.label')} className={styles.views}>
          {VIEWS.map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} className={styles.view} onClick={() => url.replaceAll({ view: v === 'discussions' ? null : v }, { push: true })}>
              {t(`discussion.views.${v}`)}
            </button>
          ))}
        </div>
        {view === 'discussions' && can('comment') ? (
          <Button variant="primary" onClick={() => url.set({ new: '1' }, { keepPage: true })}>
            {t('discussion.new.open')}
          </Button>
        ) : null}
        {view === 'tasks' && can('manageTasks') ? (
          <Button variant="primary" onClick={() => url.set({ new: '1' }, { keepPage: true })}>
            {t('discussion.tasks.new')}
          </Button>
        ) : null}
      </div>

      {!can('comment') ? (
        <p>
          <NeutralState kind="limitation">{t('discussion.readOnly', { role: t(ROLE_LABEL_KEYS[role]) })}</NeutralState>
        </p>
      ) : null}

      {view === 'discussions' ? (
        <DiscussionsView projectId={id} canStart={can('comment')} canReply={can('comment')} canResolve={can('resolveDiscussion')} onStart={() => url.set({ new: '1' }, { keepPage: true })} />
      ) : (
        <TasksView projectId={id} canManage={can('manageTasks')} creating={creating && can('manageTasks')} onCreateClose={closeNew} />
      )}

      {view === 'discussions' && creating && can('comment') ? (
        <NewThreadDialog
          projectId={id}
          target={target}
          onClose={closeNew}
          onCreated={(th) => url.replaceAll({ thread: th.id }, { push: false })}
        />
      ) : null}
    </section>
  )
}
