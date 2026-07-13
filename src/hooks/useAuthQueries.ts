import { useQuery } from '@tanstack/react-query'
import { fetchAuthModeratedContests, fetchAuthProfile } from '../lib/queries/auth'
import { queryKeys } from '../lib/queries/keys'

export function useAuthProfile(userId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.authProfile(userId ?? ''),
    queryFn: () => fetchAuthProfile(userId!),
    enabled: Boolean(userId),
  })
}

export function useAuthModeratedContests(userId: string | null | undefined, isAdmin: boolean) {
  return useQuery({
    queryKey: queryKeys.moderatedContests(userId ?? ''),
    queryFn: () => fetchAuthModeratedContests(userId!),
    enabled: Boolean(userId) && !isAdmin,
  })
}
