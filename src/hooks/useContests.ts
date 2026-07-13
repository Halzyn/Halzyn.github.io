import { useQuery } from '@tanstack/react-query'
import {
  fetchContestsWithHosts,
  fetchModeratedContestIds,
  fetchScheduledContestTeasers,
  hostsByContestIdFromContests,
} from '../lib/queries/contests'
import { queryKeys } from '../lib/queries/keys'

export function useContests() {
  const query = useQuery({
    queryKey: queryKeys.contests,
    queryFn: fetchContestsWithHosts,
  })

  const contests = query.data ?? []
  const hostsByContestId = hostsByContestIdFromContests(contests)

  return {
    contests,
    hostsByContestId,
    loadError: query.error instanceof Error ? query.error.message : null,
    loading: query.isPending && query.data === undefined,
    refetch: query.refetch,
  }
}

export function useScheduledContestTeasers() {
  return useQuery({
    queryKey: queryKeys.scheduledTeasers,
    queryFn: fetchScheduledContestTeasers,
  })
}

export function useModeratedContestIds(userId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.moderatedContestIds(userId ?? ''),
    queryFn: () => fetchModeratedContestIds(userId!),
    enabled: Boolean(userId),
  })
}
