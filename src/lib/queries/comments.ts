import { fetchCommentEdits, fetchContestComments } from '../contestComments'
import { getSupabase } from '../supabase'

export async function fetchContestCommentsQuery(contestId: string) {
  return fetchContestComments(getSupabase(), contestId)
}

export async function fetchCommentEditsQuery(commentId: string) {
  return fetchCommentEdits(getSupabase(), commentId)
}
