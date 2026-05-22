import type { SupabaseClient } from '@supabase/supabase-js'
import { displayNameStyleInfoFromProfileFields, type DisplayNameStyleInfo } from './displayNameStyle'

export type ContestCommentRow = {
  id: string
  contest_id: string
  parent_id: string | null
  user_id: string
  body: string | null
  created_at: string
  updated_at: string
  deleted: boolean
  display_name: string
  username: string | null
  display_name_color?: string | null
  display_name_color_2?: string | null
  display_name_effect?: string | null
  avatar_path: string | null
  upvotes: number
  downvotes: number
  score: number
  my_vote: number | null
  edit_count: number
}

export type ContestCommentEdit = {
  id: string
  body: string
  edited_at: string
}

export type CommentSortMode = 'top' | 'new' | 'old'

export function parseContestCommentsPayload(raw: unknown): ContestCommentRow[] {
  if (!raw || typeof raw !== 'object') return []
  const payload = raw as { comments?: unknown }
  if (!Array.isArray(payload.comments)) return []
  return payload.comments
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'))
    .map((row) => ({
      id: String(row.id),
      contest_id: String(row.contest_id),
      parent_id: row.parent_id == null ? null : String(row.parent_id),
      user_id: String(row.user_id),
      body: row.body == null ? null : String(row.body),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      deleted: Boolean(row.deleted),
      display_name: String(row.display_name ?? 'Player'),
      username: row.username == null ? null : String(row.username),
      display_name_color: row.display_name_color == null ? null : String(row.display_name_color),
      display_name_color_2: row.display_name_color_2 == null ? null : String(row.display_name_color_2),
      display_name_effect: row.display_name_effect == null ? null : String(row.display_name_effect),
      avatar_path: row.avatar_path == null ? null : String(row.avatar_path),
      upvotes: Number(row.upvotes ?? 0),
      downvotes: Number(row.downvotes ?? 0),
      score: Number(row.score ?? 0),
      my_vote: row.my_vote == null ? null : Number(row.my_vote),
      edit_count: Number(row.edit_count ?? 0),
    }))
}

export function commentDisplayNameStyle(row: ContestCommentRow): DisplayNameStyleInfo | null {
  return displayNameStyleInfoFromProfileFields({
    display_name_color: row.display_name_color,
    display_name_color_2: row.display_name_color_2,
    display_name_effect: row.display_name_effect,
  })
}

export function sortContestComments(rows: ContestCommentRow[], mode: CommentSortMode): ContestCommentRow[] {
  const copy = [...rows]
  if (mode === 'new') {
    return copy.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  }
  if (mode === 'old') {
    return copy.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
  }
  return copy.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return Date.parse(b.created_at) - Date.parse(a.created_at)
  })
}

export type CommentTreeNode = ContestCommentRow & { replies: CommentTreeNode[] }

export function buildCommentTree(rows: ContestCommentRow[], mode: CommentSortMode): CommentTreeNode[] {
  const byId = new Map<string, CommentTreeNode>()
  for (const row of rows) {
    byId.set(row.id, { ...row, replies: [] })
  }

  const roots: CommentTreeNode[] = []
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.replies.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortReplies = (nodes: CommentTreeNode[]) => {
    const sorted = sortContestComments(nodes, mode)
    nodes.length = 0
    nodes.push(...sorted.map((row) => byId.get(row.id)!))
    for (const child of nodes) {
      if (child.replies.length) sortReplies(child.replies)
    }
  }

  const sortedRoots = sortContestComments(roots, mode).map((row) => byId.get(row.id)!)
  for (const root of sortedRoots) {
    if (root.replies.length) sortReplies(root.replies)
  }
  return sortedRoots
}

export async function fetchContestComments(
  client: SupabaseClient,
  contestId: string,
): Promise<ContestCommentRow[]> {
  const { data, error } = await client.rpc('list_contest_comments', { p_contest_id: contestId })
  if (error) throw error
  return parseContestCommentsPayload(data)
}

export async function fetchCommentEdits(
  client: SupabaseClient,
  commentId: string,
): Promise<{ edits: ContestCommentEdit[]; currentBody: string | null }> {
  const { data, error } = await client.rpc('list_contest_comment_edits', { p_comment_id: commentId })
  if (error) throw error
  const payload = data as { edits?: unknown; current_body?: string | null } | null
  const edits = Array.isArray(payload?.edits)
    ? payload!.edits
        .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object'))
        .map((row) => ({
          id: String(row.id),
          body: String(row.body),
          edited_at: String(row.edited_at),
        }))
    : []
  return {
    edits,
    currentBody: payload?.current_body == null ? null : String(payload.current_body),
  }
}
