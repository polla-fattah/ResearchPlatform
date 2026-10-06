import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { addComment, COMMENTS_PER_PAGE, listComments } from '@/api/discussion'
import { invalidate } from '@/api/invalidate'
import { qk } from '@/api/queryKeys'
import type { Thread } from '@/api/schemas/discussion'
import { usePreferences } from '@/app/preferencesContext'
import { BidiText } from '@/components/BidiText'
import { Button } from '@/components/Button'
import { MutationNotice } from '@/components/MutationNotice'
import { Pagination } from '@/components/Pagination'
import { formatCode } from '@/domain/codes'
import { openedBy, targetHref } from './discussionModel'
import { ResolveDialog } from './ResolveDialog'
import styles from './Discussion.module.css'

interface Props {
  projectId: number
  thread: Thread
  page: number
  onPage: (page: number) => void
  canReply: boolean
  canResolve: boolean
}

/**
 * One discussion: what it is about, the replies, the decision if there is one, and a reply box. The reply being
 * typed is this component's only state; it is dropped by remounting when another thread is opened (the parent keys
 * it by thread), and kept when posting fails.
 */
export function ThreadView({ projectId, thread, page, onPage, canReply, canResolve }: Props) {
  const { t } = useTranslation()
  const { date } = usePreferences()
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [resolving, setResolving] = useState(false)

  const comments = useQuery({
    queryKey: qk.project(projectId).discussion.comments(thread.id, page),
    queryFn: ({ signal }) => listComments(thread.id, page, signal),
  })
  const post = useMutation({
    mutationFn: () => addComment(thread.id, text.trim()),
    onSuccess: async () => {
      setText('')
      await invalidate.discussionChanged(qc, projectId)
    },
  })

  const items = comments.data?.items ?? []
  const href = targetHref(projectId, thread.target_type, thread.target_id)
  const targetText = t(`discussion.targets.${thread.target_type ?? 'project'}`, { id: thread.target_id ?? '', defaultValue: thread.target_type ?? '' })
  const by = page === 1 ? openedBy(items) : null

  return (
    <article className={styles.thread} aria-label={thread.title}>
      <header>
        <p className={styles.meta}>
          <span className="mono">{formatCode('D', thread.id)}</span>
          {by ? ` · ${t('discussion.startedBy', { name: by })}` : ''}
        </p>
        <h2>
          <BidiText>{thread.title}</BidiText>
        </h2>
        <p className={styles.meta}>
          {t('discussion.on')} {href ? <Link to={href}>{targetText}</Link> : targetText}
        </p>
      </header>

      {thread.context_quote ? (
        <blockquote className={styles.quote}>
          <BidiText>{thread.context_quote}</BidiText>
          {thread.context_locator ? <div className={styles.meta}>{thread.context_locator}</div> : null}
        </blockquote>
      ) : null}

      {thread.is_resolved ? (
        <section className={styles.decision} aria-label={t('discussion.decision.title')}>
          <p>
            <strong>{t('discussion.decision.title')}</strong>
            {thread.resolver?.display_name ? ` · ${t('discussion.decision.by', { name: thread.resolver.display_name })}` : ''}
            {thread.resolved_at ? ` · ${date(thread.resolved_at, { time: true })}` : ''}
          </p>
          {thread.resolution_notes ? (
            <p>
              <BidiText>{thread.resolution_notes}</BidiText>
            </p>
          ) : null}
          {thread.alternative_interpretation ? (
            <p>
              {t('discussion.decision.alternative')}: <BidiText>{thread.alternative_interpretation}</BidiText>
            </p>
          ) : null}
          <p className={styles.meta}>{t('discussion.decision.noCorpus')}</p>
        </section>
      ) : null}

      {comments.isPending ? <p className={styles.meta}>{t('states.loading.label')}</p> : null}
      {comments.isError ? (
        <div role="alert" className={styles.empty}>
          <p>{t('discussion.comments.failed')}</p>
          <Button onClick={() => void comments.refetch()}>{t('common.retry')}</Button>
        </div>
      ) : null}
      <ol className={styles.comments} aria-label={t('discussion.comments.label')}>
        {items.map((c) => (
          <li key={c.id} className={styles.comment}>
            <header>
              <span className={styles.who}>
                <BidiText>{c.author?.display_name ?? t('discussion.comments.unknown')}</BidiText>
              </span>
              {c.created_at ? <span className={styles.meta}>{date(c.created_at, { time: true })}</span> : null}
            </header>
            <p dir="auto">{c.content}</p>
          </li>
        ))}
      </ol>
      {comments.data?.pagination ? (
        <Pagination pagination={{ ...comments.data.pagination, per_page: COMMENTS_PER_PAGE }} onPage={onPage} />
      ) : null}

      {canReply ? (
        <form
          className={styles.composer}
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim()) post.mutate()
          }}
        >
          <label htmlFor={`reply-${thread.id}`}>{thread.is_resolved ? t('discussion.reply.underDecision') : t('discussion.reply.label')}</label>
          <textarea id={`reply-${thread.id}`} dir="auto" value={text} onChange={(e) => setText(e.target.value)} />
          <MutationNotice error={post.error} title={t('discussion.reply.failed')}>
            <p className={styles.meta}>{t('discussion.reply.kept')}</p>
          </MutationNotice>
          <div className={styles.actions}>
            <Button type="submit" variant="primary" disabled={post.isPending || !text.trim()}>
              {post.isPending ? t('discussion.reply.posting') : t('discussion.reply.post')}
            </Button>
            {canResolve && !thread.is_resolved ? <Button onClick={() => setResolving(true)}>{t('discussion.resolve.open')}</Button> : null}
          </div>
          <p className={styles.meta}>{t('discussion.reply.visible')}</p>
        </form>
      ) : (
        <p className={styles.meta}>{t('discussion.reply.cannot')}</p>
      )}

      {resolving ? <ResolveDialog projectId={projectId} thread={thread} onClose={() => setResolving(false)} /> : null}
    </article>
  )
}
