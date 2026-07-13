import { useQuery } from '@tanstack/react-query'
import { fetchCommentEditsQuery, fetchContestCommentsQuery } from '../lib/queries/comments'
import { queryKeys } from '../lib/queries/keys'

export function useContestComments(contestId: string, commentsOpen: boolean) {
  return useQuery({
    queryKey: queryKeys.contestComments(contestId),
    queryFn: () => fetchContestCommentsQuery(contestId),
    enabled: commentsOpen,
  })
}

export function useCommentEdits(commentId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.commentEdits(commentId),
    queryFn: () => fetchCommentEditsQuery(commentId),
    enabled,
  })
}
