import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { blockTask, createTask, dayOf, updateTask } from '@/api/discussion'
import { invalidate } from '@/api/invalidate'
import { listMembers } from '@/api/members'
import { qk } from '@/api/queryKeys'
import type { Task } from '@/api/schemas/discussion'
import { Button } from '@/components/Button'
import { Field } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { MutationNotice } from '@/components/MutationNotice'
import { formatCode } from '@/domain/codes'
import { normalizeRole } from '@/domain/roles'
import dialog from '@/components/Dialog.module.css'
import { dueForServer } from './discussionModel'

/**
 * Create a task, or change one. The assignee is chosen among the project's members (the server would accept anyone).
 * Done and Blocked are not choices here: they have their own actions, because Blocked needs a reason and Done records
 * when. Mounted only while open, so its draft is gone when it closes.
 */
export function TaskDialog({ projectId, task, onClose }: { projectId: number; task: Task | null; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const members = useQuery({ queryKey: qk.project(projectId).members.list, queryFn: ({ signal }) => listMembers(projectId, signal) })

  const schema = z.object({
    title: z.string().trim().min(1, t('discussion.task.titleRequired')).max(500),
    description: z.string(),
    assignee: z.string(),
    due: z.string(),
    status: z.enum(['open', 'in_progress']),
  })
  type Values = z.infer<typeof schema>
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      assignee: task?.assignee_id ? String(task.assignee_id) : '',
      due: dayOf(task?.due_date),
      status: task?.status === 'in_progress' ? 'in_progress' : 'open',
    },
  })

  const save = useMutation({
    mutationFn: (v: Values) => {
      const fields = {
        title: v.title.trim(),
        description: v.description.trim() || null,
        assignee_id: v.assignee ? Number(v.assignee) : null,
        due_date: dueForServer(v.due),
      }
      if (!task) return createTask(projectId, fields)
      const locked = task.status === 'done' || task.status === 'blocked'
      return updateTask(projectId, task.id, locked ? fields : { ...fields, status: v.status })
    },
    onSuccess: async () => {
      await invalidate.tasksChanged(qc, projectId)
      onClose()
    },
  })

  const locked = task?.status === 'done' || task?.status === 'blocked'
  return (
    <Modal title={task ? t('discussion.task.editTitle', { code: formatCode('T', task.id) }) : t('discussion.task.newTitle')} onClose={onClose} wide>
      <form noValidate onSubmit={handleSubmit((v) => save.mutate(v))}>
        <Field label={t('discussion.task.titleLabel')} requirement="required" error={errors.title?.message}>
          <input dir="auto" aria-invalid={errors.title ? true : undefined} {...register('title')} />
        </Field>
        <Field label={t('discussion.task.description')} requirement="optional">
          <textarea rows={3} dir="auto" {...register('description')} />
        </Field>
        <Field label={t('discussion.task.assignee')} requirement="optional" hint={t('discussion.task.assigneeHint')}>
          <select {...register('assignee')}>
            <option value="">{t('discussion.task.unassigned')}</option>
            {(members.data ?? []).map((m) => {
              const role = normalizeRole(m.role)
              return (
                <option key={m.user_id} value={m.user_id}>
                  {m.user?.display_name ?? m.user_id}
                  {role ? ` · ${t(`roles.${role}`)}` : ''}
                </option>
              )
            })}
          </select>
        </Field>
        <Field label={t('discussion.task.due')} requirement="optional">
          <input type="date" {...register('due')} />
        </Field>
        {task && !locked ? (
          <Field label={t('discussion.task.state')}>
            <select {...register('status')}>
              <option value="open">{t('discussion.task.states.open')}</option>
              <option value="in_progress">{t('discussion.task.states.in_progress')}</option>
            </select>
          </Field>
        ) : null}
        {task && locked ? <p>{t('discussion.task.lockedState', { state: t(`discussion.task.states.${task.status}`) })}</p> : null}
        <p>{t('discussion.task.doneNote')}</p>
        <MutationNotice error={save.error} title={t('discussion.task.failed')} />
        <div className={dialog.actions}>
          <Button onClick={onClose} disabled={save.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {t('discussion.task.save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/** Mark a task blocked: the reason is required (the server asks for three characters) and is shown on the task. */
export function BlockDialog({ projectId, task, onClose }: { projectId: number; task: Task; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const schema = z.object({ reason: z.string().trim().min(3, t('discussion.task.reasonShort')) })
  type Values = z.infer<typeof schema>
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { reason: '' } })
  const block = useMutation({
    mutationFn: (v: Values) => blockTask(projectId, task.id, v.reason.trim()),
    onSuccess: async () => {
      await invalidate.tasksChanged(qc, projectId)
      onClose()
    },
  })
  return (
    <Modal title={t('discussion.task.blockTitle', { code: formatCode('T', task.id) })} onClose={onClose}>
      <form noValidate onSubmit={handleSubmit((v) => block.mutate(v))}>
        <p>
          <strong>{task.title}</strong>
        </p>
        <Field label={t('discussion.task.reason')} requirement="required" error={errors.reason?.message}>
          <textarea rows={3} dir="auto" aria-invalid={errors.reason ? true : undefined} {...register('reason')} />
        </Field>
        <MutationNotice error={block.error} title={t('discussion.task.blockFailed')} />
        <div className={dialog.actions}>
          <Button onClick={onClose} disabled={block.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={block.isPending}>
            {t('discussion.task.block')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
