import { useQuery } from '@tanstack/react-query'
import { fetchAdminContestEditBundle } from '../lib/queries/adminContest'
import { queryKeys } from '../lib/queries/keys'

export function useAdminContestEditData(contestId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.adminContest(contestId ?? ''),
    queryFn: () => fetchAdminContestEditBundle(contestId!),
    enabled: Boolean(contestId),
  })
}
