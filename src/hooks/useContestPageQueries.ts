import { useQuery } from '@tanstack/react-query'
import {
  fetchContestCoreBySlug,
  fetchContestRevealBundle,
  shouldLoadContestReveal,
} from '../lib/queries/contestPage'
import { queryKeys } from '../lib/queries/keys'

export function useContestCore(slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.contestCore(slug ?? ''),
    queryFn: () => fetchContestCoreBySlug(slug!),
    enabled: Boolean(slug),
  })
}

export function useContestReveal(
  contestId: string | undefined,
  trackIds: string[],
  deadline: string | undefined,
  resultsPublished: boolean,
  ready: boolean,
  isAdmin: boolean,
  contestMod: boolean,
) {
  const shouldLoad = Boolean(
    contestId &&
      trackIds.length > 0 &&
      deadline &&
      shouldLoadContestReveal(deadline, resultsPublished, ready, isAdmin, contestMod),
  )

  return useQuery({
    queryKey: queryKeys.contestReveal(contestId ?? ''),
    queryFn: () => fetchContestRevealBundle(contestId!, trackIds),
    enabled: shouldLoad,
  })
}
