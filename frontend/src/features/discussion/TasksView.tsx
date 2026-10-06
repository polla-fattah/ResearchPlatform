import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { completeTask, listTasks, TASKS_PER_PAGE } from '@/api/discussion'
import { invalidate } from '@/api/invalidate'
import { qk } from '@/api/queryKeys'
import { TASK_STATUSES, type Task, type TaskStatus } from '@/api/schemas/discussion'
import { useAuth } from '@/app/authContext'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { MutationNotice } from '@/components/MutationNotice'
import { Pagination } from '@/components/Pagination'
import { RefreshNotice } from '@/components/RefreshNotice'
import { StateBoundary } from '@/components/StateBoundary'
import { viewStateOf } from '@/components/viewState'
import { formatCode } from '@/domain/codes'
import { useQueryParams } from '@/hooks/useQueryParams'
import { dueState } from './discussionModel'
import { BlockDialog, TaskDialog } from './TaskDialogs'
import styles from './Discussion.module.css'

type Dialog = { kind: 'edit'; task: Task } | { kind: 'block'; task: Task } | null
const STATUS_FILTERS = ['all', ...TASK_STATUSES] as const

/** Tasks of the project. The state and "mine" filters and the page are in the address; the open dialog is local. */
export function TasksView({ projectId, canManage, creating, onCreateClose }: { projectId: number; canManage: boolean; creating: boolean; onCreateClose: () => void }) {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const { user } = useAuth()
  const qc = useQueryClient()
  const url = useQueryParams()
  const [dialog, setDialog] = useState<Dialog>(null)
  const status = url.oneOf('status', STATUS_FILTERS, 'all')
  const mine = url.text('mine') === '1'

  const query = {
    status: status === 'all' ? undefined : (status as TaskStatus),
    assignee_id: mine && user ? user.id : undefined,
    page: url.page,
  }
  const list = useQuery({
    queryKey: qk.project(projectId).discussion.tasks(query),
    queryFn: ({ signal }) => listTasks(projectId, query, signal),
    placeholderData: keepPreviousData,
  })
  const complete = useMutation({
    mutationFn: (task: Task) => completeTask(projectId, task.id),
    onSuccess: () => invalidate.tasksChanged(qc, projectId),
  })

  const items = list.data?.items ?? []
  const filtered = status !== 'all' || mine
  const view = list.data ? (items.length === 0 ? 'empty' : 'normal') : viewStateOf(list)
  const asOf = list.dataUpdatedAt

  return (
    <div className={styles.stack}>
      <div className={styles.filters} role="group" aria-label={t('discussion.tasks.filter')}>
        {STATUS_FILTERS.map((s) => (
          <button key={s} type="button" className={styles.chip} aria-pressed={status === s} onClick={() => url.set({ status: s === 'all' ? null : s })}>
            {s === 'all' ? t('discussion.tasks.all') : t(`discussion.task.states.${s}`)}
          </button>
        ))}
        <button type="button" className={styles.chip} aria-pressed={mine} onClick={() => url.set({ mine: mine ? null : '1' })}>
          {t('discussion.tasks.mine')}
        </button>
      </div>
      <MutationNotice error={complete.error} title={t('discussion.task.completeFailed')} />
      <StateBoundary
        state={view}
        errorValue={list.error}
        onRetry={() => void list.refetch()}
        empty={
          <div className={styles.empty}>
            <h3>{filtered ? t('discussion.tasks.noneFiltered') : t('discussion.tasks.emptyTitle')}</h3>
            {!filtered ? <p>{t('discussion.tasks.emptyBody')}</p> : null}
            {canManage && !filtered ? (
              <Button variant="primary" onClick={() => url.set({ new: '1' }, { keepPage: true })}>
                {t('discussion.tasks.new')}
              </Button>
            ) : null}
          </div>
        }
      >
        <RefreshNotice query={list} what={t('discussion.views.tasks')} />
        <table className={styles.table} aria-label={t('discussion.tasks.label')}>
          <thead>
            <tr>
              <th scope="col">{t('discussion.task.titleLabel')}</th>
              <th scope="col">{t('discussion.task.state')}</th>
              <th scope="col">{t('discussion.task.assignee')}</th>
              <th scope="col">{t('discussion.task.due')}</th>
              <th scope="col">
                <span className="sr-only">{t('members.table.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((task) => {
              const due = dueState(task, asOf)
              return (
                <tr key={task.id}>
                  <th scope="row">
                    <BidiText>{task.title}</BidiText>
                    <div className={styles.meta}>
                      <span className="mono">{formatCode('T', task.id)}</span>
                    </div>
                    {task.status === 'blocked' && task.blocking_reason ? (
                      <div className={styles.blocked}>
                        {t('discussion.task.blockedBecause')}: <BidiText>{task.blocking_reason}</BidiText>
                      </div>
                    ) : null}
                  </th>
                  <td>{t(`discussion.task.states.${task.status}`, { defaultValue: task.status })}</td>
                  <td>{task.assignee?.display_name ? <BidiText>{task.assignee.display_name}</BidiText> : <span className={styles.meta}>{t('discussion.task.unassigned')}</span>}</td>
                  <td>
                    {task.due_date ? date(task.due_date.slice(0, 10)) : <span className={styles.meta}>{t('discussion.task.noDue')}</span>}
                    {due === 'overdue' ? <div className={styles.overdue}>{t('discussion.task.overdue')}</div> : null}
                    {due === 'today' ? <div className={styles.meta}>{t('discussion.task.dueToday')}</div> : null}
                  </td>
                  <td>
                    {canManage ? (
                      <div className={styles.actions}>
                        <Button onClick={() => setDialog({ kind: 'edit', task })} aria-label={t('discussion.task.editOf', { title: task.title })}>
                          {t('discussion.task.edit')}
                        </Button>
                        {task.status !== 'done' ? (
                          <Button onClick={() => complete.mutate(task)} disabled={complete.isPending} aria-label={t('discussion.task.doneOf', { title: task.title })}>
                            {t('discussion.task.markDone')}
                          </Button>
                        ) : null}
                        {task.status !== 'done' && task.status !== 'blocked' ? (
                          <Button onClick={() => setDialog({ kind: 'block', task })} aria-label={t('discussion.task.blockOf', { title: task.title })}>
                            {t('discussion.task.block')}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {list.data?.pagination ? <Pagination pagination={{ ...list.data.pagination, per_page: TASKS_PER_PAGE }} onPage={(p) => url.set({ page: p })} /> : null}
      </StateBoundary>

      {creating ? <TaskDialog projectId={projectId} task={null} onClose={onCreateClose} /> : null}
      {dialog?.kind === 'edit' ? <TaskDialog projectId={projectId} task={dialog.task} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === 'block' ? <BlockDialog projectId={projectId} task={dialog.task} onClose={() => setDialog(null)} /> : null}
    </div>
  )
}
