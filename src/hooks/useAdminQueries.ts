import { useQuery } from '@tanstack/react-query'
import {
  fetchAdminContestsList,
  fetchAdminGameEditBundle,
  fetchAdminGradingBundle,
  fetchAdminUserProfile,
  fetchAdminUsersList,
} from '../lib/queries/admin'
import { queryKeys } from '../lib/queries/keys'

export function useAdminContestsList() {
  return useQuery({
    queryKey: queryKeys.adminContestsList,
    queryFn: fetchAdminContestsList,
  })
}

export function useAdminGrading(contestId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.adminGrading(contestId ?? ''),
    queryFn: () => fetchAdminGradingBundle(contestId!),
    enabled: Boolean(contestId),
  })
}

export function useAdminUsersList() {
  return useQuery({
    queryKey: queryKeys.adminUsers,
    queryFn: fetchAdminUsersList,
  })
}

export function useAdminUserProfile(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.adminUser(userId ?? ''),
    queryFn: () => fetchAdminUserProfile(userId!),
    enabled: Boolean(userId),
  })
}

export function useAdminGameEdit(gameId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.adminGame(gameId ?? ''),
    queryFn: () => fetchAdminGameEditBundle(gameId!),
    enabled: Boolean(gameId) && enabled,
  })
}
