import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { avatarPublicUrl } from '../lib/avatar'
import { getSupabase } from '../lib/supabase'
import {
  buildCommentTree,
  commentDisplayNameStyle,
  type CommentSortMode,
  type CommentTreeNode,
  type ContestCommentRow,
} from '../lib/contestComments'
import { COMMENT_MAX_LENGTH } from '../lib/commentMarkdown'
import { queryKeys } from '../lib/queries/keys'
import { useCommentEdits, useContestComments } from '../hooks/useContestCommentsQueries'
import { CommentMarkdownBody } from './CommentMarkdownBody'
import { CommentMarkdownEditor, CommentMarkdownEditorHint } from './CommentMarkdownEditor'
import { DisplayNameStyled } from './DisplayNameStyled'

type Props = {
  contestId: string
  commentsOpen: boolean
  canModerate: boolean
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString()
}

function CommentAuthorSidebar({ node }: { node: CommentTreeNode }) {
  const supabase = getSupabase()
  const profileLink = node.username ? `/players/${encodeURIComponent(node.username)}` : null
  const nameStyle = commentDisplayNameStyle(node)
  const avatarSrc = useMemo(() => avatarPublicUrl(supabase, node.avatar_path), [node.avatar_path, supabase])

  const name = profileLink ? (
    <Link to={profileLink} className="comment-item-name-link">
      <DisplayNameStyled text={node.display_name} info={nameStyle} />
    </Link>
  ) : (
    <DisplayNameStyled text={node.display_name} info={nameStyle} />
  )

  const avatar = avatarSrc ? (
    <img
      key={node.avatar_path ?? node.user_id}
      src={avatarSrc}
      alt=""
      className="player-card-avatar"
      width={40}
      height={40}
      decoding="async"
    />
  ) : (
    <span className="player-card-avatar player-card-avatar--placeholder" aria-hidden />
  )

  return (
    <aside className="comment-item-sidebar">
      <div className="comment-item-name">{name}</div>
      {profileLink ? (
        <Link to={profileLink} className="comment-item-avatar-link" aria-hidden tabIndex={-1}>
          {avatar}
        </Link>
      ) : (
        avatar
      )}
    </aside>
  )
}

function CommentEditHistory({ commentId, editCount }: { commentId: string; editCount: number }) {
  const [expanded, setExpanded] = useState(false)
  const { data, isLoading, error } = useCommentEdits(commentId, expanded && editCount >= 1)

  if (editCount < 1) return null

  const edits = data?.edits ?? null
  const currentBody = data?.currentBody ?? null
  const errorMessage = error instanceof Error ? error.message : null

  return (
    <details
      className="comment-edit-history"
      onToggle={(event) => {
        setExpanded((event.target as HTMLDetailsElement).open)
      }}
    >
      <summary className="linkish small">
        {editCount} edit{editCount === 1 ? '' : 's'}
      </summary>
      {isLoading ? <p className="muted small">Loading edit history...</p> : null}
      {errorMessage ? <p className="banner warn small">{errorMessage}</p> : null}
      {edits ? (
        <ul className="comment-edit-list">
          {currentBody ? (
            <li>
              <span className="muted small">Current</span>
              <CommentMarkdownBody body={currentBody} />
            </li>
          ) : null}
          {edits.map((edit) => (
            <li key={edit.id}>
              <span className="muted small">{formatWhen(edit.edited_at)}</span>
              <CommentMarkdownBody body={edit.body} />
            </li>
          ))}
        </ul>
      ) : null}
    </details>
  )
}

type CommentItemProps = {
  node: CommentTreeNode
  depth: number
  commentsOpen: boolean
  canModerate: boolean
  userId: string | null
  onRefresh: () => void
  onVoteUpdate: (commentId: string, patch: Partial<ContestCommentRow>) => void
}

function CommentItem({
  node,
  depth,
  commentsOpen,
  canModerate,
  userId,
  onRefresh,
  onVoteUpdate,
}: CommentItemProps) {
  const supabase = getSupabase()
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editBody, setEditBody] = useState(node.body ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isOwner = userId != null && node.user_id === userId

  async function submitReply() {
    const trimmed = replyBody.trim()
    if (!trimmed || trimmed.length > COMMENT_MAX_LENGTH) return
    setBusy(true)
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc('post_contest_comment', {
        p_contest_id: node.contest_id,
        p_body: trimmed,
        p_parent_id: node.id,
      })
      if (rpcError) throw rpcError
      setReplyBody('')
      setReplyOpen(false)
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post reply')
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit() {
    const trimmed = editBody.trim()
    if (!trimmed || trimmed.length > COMMENT_MAX_LENGTH) return
    setBusy(true)
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc('edit_contest_comment', {
        p_comment_id: node.id,
        p_body: trimmed,
      })
      if (rpcError) throw rpcError
      setEditOpen(false)
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save edit')
    } finally {
      setBusy(false)
    }
  }

  async function castVote(vote: 1 | -1) {
    if (!userId) return
    setBusy(true)
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('vote_contest_comment', {
        p_comment_id: node.id,
        p_vote: vote,
      })
      if (rpcError) throw rpcError
      const payload = data as {
        upvotes?: number
        downvotes?: number
        score?: number
        my_vote?: number | null
      } | null
      onVoteUpdate(node.id, {
        upvotes: Number(payload?.upvotes ?? 0),
        downvotes: Number(payload?.downvotes ?? 0),
        score: Number(payload?.score ?? 0),
        my_vote: payload?.my_vote == null ? null : Number(payload.my_vote),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to vote')
    } finally {
      setBusy(false)
    }
  }

  async function removeComment() {
    if (!window.confirm('Delete this comment?')) return
    setBusy(true)
    setError(null)
    try {
      const { error: rpcError } = await supabase.rpc('delete_contest_comment', {
        p_comment_id: node.id,
      })
      if (rpcError) throw rpcError
      onRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article
      className="comment-item site-inset"
      style={{ marginLeft: depth > 0 ? `${Math.min(depth, 8) * 1.1}rem` : undefined }}
    >
      <header className="comment-item-meta row spread">
        <span className="muted small comment-item-when">
          {formatWhen(node.created_at)}
          {node.updated_at !== node.created_at ? <span> edited</span> : null}
        </span>
        <span className="comment-votes row tight">
          <button
            type="button"
            className={`comment-vote-btn${node.my_vote === 1 ? ' is-active' : ''}`}
            title="Upvote"
            disabled={!userId || !commentsOpen || busy || node.deleted}
            onClick={() => void castVote(1)}
          >
            ▲ {node.upvotes}
          </button>
          <button
            type="button"
            className={`comment-vote-btn${node.my_vote === -1 ? ' is-active' : ''}`}
            title="Downvote"
            disabled={!userId || !commentsOpen || busy || node.deleted}
            onClick={() => void castVote(-1)}
          >
            ▼ {node.downvotes}
          </button>
        </span>
      </header>

      <div className="comment-item-layout">
        <CommentAuthorSidebar node={node} />
        <div className="comment-item-main">
          {node.deleted ? (
            <p className="comment-deleted muted">[deleted by moderator]</p>
          ) : editOpen ? (
            <div className="comment-edit-form">
              <CommentMarkdownEditor value={editBody} onChange={setEditBody} disabled={busy} rows={4} />
              <div className="actions">
                <button type="button" className="button small primary" disabled={busy} onClick={() => void saveEdit()}>
                  Save
                </button>
                <button
                  type="button"
                  className="button small ghost"
                  disabled={busy}
                  onClick={() => {
                    setEditOpen(false)
                    setEditBody(node.body ?? '')
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <CommentMarkdownBody body={node.body ?? ''} />
          )}

          {!node.deleted ? <CommentEditHistory commentId={node.id} editCount={node.edit_count} /> : null}

          {error ? <p className="banner warn small">{error}</p> : null}

          <footer className="comment-item-actions row tight">
            {commentsOpen && userId && !node.deleted ? (
              <button type="button" className="linkish small" onClick={() => setReplyOpen((open) => !open)}>
                {replyOpen ? 'Cancel reply' : 'Reply'}
              </button>
            ) : null}
            {isOwner && !node.deleted && commentsOpen ? (
              <button type="button" className="linkish small" onClick={() => setEditOpen((open) => !open)}>
                {editOpen ? 'Cancel edit' : 'Edit'}
              </button>
            ) : null}
            {canModerate && !node.deleted ? (
              <button
                type="button"
                className="linkish small comment-delete-btn"
                disabled={busy}
                onClick={() => void removeComment()}
              >
                Delete
              </button>
            ) : null}
          </footer>

          {replyOpen && commentsOpen && userId ? (
            <div className="comment-reply-form">
              <CommentMarkdownEditor
                value={replyBody}
                onChange={setReplyBody}
                disabled={busy}
                placeholder="Write a reply..."
                rows={3}
              />
              <button
                type="button"
                className="button small primary"
                disabled={busy || !replyBody.trim()}
                onClick={() => void submitReply()}
              >
                Post reply
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {node.replies.map((child) => (
        <CommentItem
          key={child.id}
          node={child}
          depth={depth + 1}
          commentsOpen={commentsOpen}
          canModerate={canModerate}
          userId={userId}
          onRefresh={onRefresh}
          onVoteUpdate={onVoteUpdate}
        />
      ))}
    </article>
  )
}

export function ContestComments({ contestId, commentsOpen, canModerate }: Props) {
  const supabase = getSupabase()
  const queryClient = useQueryClient()
  const { userId, ready } = useAuth()
  const [sortMode, setSortMode] = useState<CommentSortMode>('top')
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const [votePatches, setVotePatches] = useState<Record<string, Partial<ContestCommentRow>>>({})

  const { data: rows = [], isLoading, error: loadError } = useContestComments(contestId, commentsOpen)

  const mergedRows = useMemo(
    () => rows.map((row) => (votePatches[row.id] ? { ...row, ...votePatches[row.id] } : row)),
    [rows, votePatches],
  )

  const tree = useMemo(() => buildCommentTree(mergedRows, sortMode), [mergedRows, sortMode])

  const refreshComments = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.contestComments(contestId) })
  }

  function patchVote(commentId: string, patch: Partial<ContestCommentRow>) {
    setVotePatches((prev) => ({ ...prev, [commentId]: { ...prev[commentId], ...patch } }))
  }

  async function postComment() {
    const trimmed = body.trim()
    if (!trimmed || !userId) return
    setPosting(true)
    setPostError(null)
    try {
      const { error: rpcError } = await supabase.rpc('post_contest_comment', {
        p_contest_id: contestId,
        p_body: trimmed,
        p_parent_id: null,
      })
      if (rpcError) throw rpcError
      setBody('')
      refreshComments()
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Failed to post comment')
    } finally {
      setPosting(false)
    }
  }

  const signedIn = ready && Boolean(userId)
  const composerDisabled = !commentsOpen || !signedIn || posting
  const error =
    postError ?? (loadError instanceof Error ? loadError.message : null)

  return (
    <div className="contest-comments">
      <div className="row spread contest-comments-head">
        <h3 className="reveal-subhead">Comments</h3>
        {commentsOpen ? (
          <label className="field row contest-comments-sort">
            <span className="muted small">Sort</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as CommentSortMode)}>
              <option value="top">Top votes</option>
              <option value="new">Newest</option>
              <option value="old">Oldest</option>
            </select>
          </label>
        ) : null}
      </div>

      {!commentsOpen ? (
        <p className="muted small">Comments open after results are published.</p>
      ) : (
        <>
          <div className="comment-compose site-inset">
            <p className="site-inset-head">Post a comment</p>
            <div className="site-inset-body">
              {!signedIn ? (
                <p className="comment-compose-placeholder">
                  Please sign in to comment.{' '}
                  <Link to="/auth">Sign in</Link>
                </p>
              ) : (
                <>
                  <CommentMarkdownEditor
                    value={body}
                    onChange={setBody}
                    disabled={composerDisabled}
                    placeholder="Share your thoughts on the results..."
                  />
                  <CommentMarkdownEditorHint />
                  <button
                    type="button"
                    className="button small primary"
                    disabled={composerDisabled || !body.trim()}
                    onClick={() => void postComment()}
                  >
                    {posting ? 'Posting...' : 'Post comment'}
                  </button>
                </>
              )}
            </div>
          </div>

          {isLoading ? <p className="muted">Loading comments...</p> : null}
          {error ? <p className="banner warn">{error}</p> : null}
          {!isLoading && tree.length === 0 ? <p className="muted">No comments yet.</p> : null}

          <div className="comment-thread">
            {tree.map((node) => (
              <CommentItem
                key={node.id}
                node={node}
                depth={0}
                commentsOpen={commentsOpen}
                canModerate={canModerate}
                userId={userId}
                onRefresh={refreshComments}
                onVoteUpdate={patchVote}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
