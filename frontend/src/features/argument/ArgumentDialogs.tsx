import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { createEdge, createNode, updateNode } from '@/api/argument'
import { ApiError } from '@/api/errors'
import { listEvidence } from '@/api/evidence'
import { listFindings } from '@/api/findings'
import { invalidate } from '@/api/invalidate'
import { qk } from '@/api/queryKeys'
import { NODE_TYPES, RELATIONS, type ArgumentEdge, type ArgumentNode } from '@/api/schemas/argument'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import dialog from '@/components/Dialog.module.css'
import { Field } from '@/components/Field'
import { Modal } from '@/components/Modal'
import { MutationNotice } from '@/components/MutationNotice'
import { evidenceCode } from '@/features/evidence/evidenceModel'
import { findingCode } from '@/features/writing/writingModel'
import { DEFAULT_RELATION, hasRelation, isNodeType, wouldLoop } from './argumentModel'

/**
 * Add a point, or change one. When `parent` is given the point is made as an answer to it: the point is created and then
 * linked, in two calls (the server has no single call for both). If the link is refused after the point was made, the
 * point stays as a top point and the error says so.
 */
export function PointDialog({ projectId, parent, existing, onClose, onSaved }: { projectId: number; parent: ArgumentNode | null; existing: ArgumentNode | null; onClose: () => void; onSaved: (id: number) => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const schema = z.object({
    type: z.enum(NODE_TYPES),
    relation: z.enum(RELATIONS),
    title: z.string().trim().min(1, t('argument.point.titleRequired')).max(255),
    content: z.string().trim().min(1, t('argument.point.contentRequired')),
    evidence: z.string(),
    finding: z.string(),
  })
  type Values = z.infer<typeof schema>
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: existing && isNodeType(existing.node_type) ? existing.node_type : parent ? 'premise' : 'claim',
      relation: 'supports',
      title: existing?.title ?? '',
      content: existing?.content ?? '',
      evidence: existing?.evidence_id ? String(existing.evidence_id) : '',
      finding: existing?.finding_id ? String(existing.finding_id) : '',
    },
  })
  const type = useWatch({ control, name: 'type' })
  const evidence = useQuery({ queryKey: qk.project(projectId).evidence.list({ per_page: 100 }), queryFn: ({ signal }) => listEvidence(projectId, { per_page: 100 }, signal) })
  const findings = useQuery({ queryKey: qk.project(projectId).findings.list(), queryFn: ({ signal }) => listFindings(projectId, {}, signal) })

  const save = useMutation({
    mutationFn: async (v: Values) => {
      const fields = { node_type: v.type, title: v.title.trim(), content: v.content.trim(), evidence_id: v.evidence ? Number(v.evidence) : undefined, finding_id: v.finding ? Number(v.finding) : undefined }
      if (existing) return updateNode(projectId, existing.id, fields)
      const made = await createNode(projectId, fields)
      if (parent) {
        try {
          await createEdge(projectId, { source_node_id: made.id, target_node_id: parent.id, relation_type: v.relation })
        } catch (error) {
          await invalidate.argumentChanged(qc, projectId)
          throw new ApiError({ status: 400, code: 'PARTIAL_SAVE', message: t('argument.point.linkFailed'), details: error })
        }
      }
      return made
    },
    onSuccess: async (node) => {
      await invalidate.argumentChanged(qc, projectId)
      onSaved(node.id)
    },
  })

  return (
    <Modal title={existing ? t('argument.point.editTitle') : parent ? t('argument.point.answerTitle', { title: parent.title }) : t('argument.point.addTitle')} onClose={onClose} wide>
      <form noValidate onSubmit={handleSubmit((v) => save.mutate(v))}>
        <Field label={t('argument.point.type')} requirement="required" hint={t('argument.point.typeHint')}>
          <select
            {...register('type', {
              onChange: (e: { target: { value: string } }) => {
                if (isNodeType(e.target.value)) setValue('relation', DEFAULT_RELATION[e.target.value])
              },
            })}
          >
            {NODE_TYPES.map((n) => (
              <option key={n} value={n}>
                {t(`argument.types.${n}`)}
              </option>
            ))}
          </select>
        </Field>
        {parent && !existing ? (
          <Field label={t('argument.point.relation', { title: parent.title })} requirement="required" hint={type ? t('argument.point.relationHint') : undefined}>
            <select {...register('relation')}>
              {RELATIONS.map((r) => (
                <option key={r} value={r}>
                  {t(`argument.relations.${r}`)}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label={t('argument.point.title')} requirement="required" error={errors.title?.message}>
          <input dir="auto" aria-invalid={errors.title ? true : undefined} {...register('title')} />
        </Field>
        <Field label={t('argument.point.content')} requirement="required" error={errors.content?.message}>
          <textarea rows={4} dir="auto" aria-invalid={errors.content ? true : undefined} {...register('content')} />
        </Field>
        <Field label={t('argument.point.evidence')} requirement="optional" hint={existing?.evidence_id ? t('argument.point.cannotUnlink') : t('argument.point.evidenceHint')}>
          <select {...register('evidence')}>
            <option value="">{t('argument.point.none')}</option>
            {(evidence.data?.items ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {evidenceCode(e.id)} · {e.captured_text.slice(0, 60)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('argument.point.finding')} requirement="optional" hint={existing?.finding_id ? t('argument.point.cannotUnlink') : t('argument.point.findingHint')}>
          <select {...register('finding')}>
            <option value="">{t('argument.point.none')}</option>
            {(findings.data?.items ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {findingCode(f.id)} · {f.claim.slice(0, 60)}
              </option>
            ))}
          </select>
        </Field>
        <MutationNotice error={save.error} title={t('argument.point.failed')} />
        <div className={dialog.actions}>
          <Button onClick={onClose} disabled={save.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={save.isPending}>
            {t('argument.point.save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/** Say that one point answers another. A loop and a repeat are refused here, before the server is asked. */
export function RelationDialog({ projectId, source, nodes, edges, onClose }: { projectId: number; source: ArgumentNode; nodes: readonly ArgumentNode[]; edges: readonly ArgumentEdge[]; onClose: () => void }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const schema = z
    .object({ target: z.string().min(1, t('argument.relation.chooseTarget')), relation: z.enum(RELATIONS) })
    .superRefine((v, ctx) => {
      const target = Number(v.target)
      if (!target) return
      if (hasRelation(edges, source.id, target, v.relation)) ctx.addIssue({ code: 'custom', path: ['target'], message: t('argument.relation.exists') })
      else if (wouldLoop(edges, source.id, target)) ctx.addIssue({ code: 'custom', path: ['target'], message: t('argument.relation.loop') })
    })
  type Values = z.infer<typeof schema>
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { target: '', relation: DEFAULT_RELATION[isNodeType(source.node_type) ? source.node_type : 'premise'] } })
  const link = useMutation({
    mutationFn: (v: Values) => createEdge(projectId, { source_node_id: source.id, target_node_id: Number(v.target), relation_type: v.relation }),
    onSuccess: async () => {
      await invalidate.argumentChanged(qc, projectId)
      onClose()
    },
  })
  return (
    <Modal title={t('argument.relation.title', { title: source.title })} onClose={onClose}>
      <form noValidate onSubmit={handleSubmit((v) => link.mutate(v))}>
        <Field label={t('argument.relation.relation')} requirement="required">
          <select {...register('relation')}>
            {RELATIONS.map((r) => (
              <option key={r} value={r}>
                {t(`argument.relations.${r}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('argument.relation.target')} requirement="required" error={errors.target?.message}>
          <select {...register('target')} aria-invalid={errors.target ? true : undefined}>
            <option value="">{t('argument.point.none')}</option>
            {nodes
              .filter((n) => n.id !== source.id)
              .map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title}
                </option>
              ))}
          </select>
        </Field>
        <p>
          <BidiText>{source.title}</BidiText>
        </p>
        <MutationNotice error={link.error} title={t('argument.relation.failed')} />
        <div className={dialog.actions}>
          <Button onClick={onClose} disabled={link.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={link.isPending}>
            {t('argument.relation.save')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
