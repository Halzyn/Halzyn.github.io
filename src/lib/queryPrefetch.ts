import { queryClient } from './queryClient'
import {
  fetchContestsWithHosts,
  fetchScheduledContestTeasers,
} from './queries/contests'
import { fetchContestCoreBySlug } from './queries/contestPage'
import { fetchGamesCatalog, fetchGamePageBundle } from './queries/games'
import {
  fetchPlayersPublicBundle,
  fetchPublicProfilePageBundle,
  fetchSiteHostBundle,
} from './queries/players'
import { queryKeys } from './queries/keys'

export function prefetchCoreAppQueries(): void {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.contests,
    queryFn: fetchContestsWithHosts,
  })
  void queryClient.prefetchQuery({
    queryKey: queryKeys.scheduledTeasers,
    queryFn: fetchScheduledContestTeasers,
  })
  void queryClient.prefetchQuery({
    queryKey: queryKeys.playersPublic,
    queryFn: fetchPlayersPublicBundle,
  })
  void queryClient.prefetchQuery({
    queryKey: queryKeys.siteHost,
    queryFn: fetchSiteHostBundle,
  })
  void queryClient.prefetchQuery({
    queryKey: queryKeys.gamesCatalog,
    queryFn: fetchGamesCatalog,
  })
}

export function prefetchContestCore(slug: string): void {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.contestCore(slug),
    queryFn: () => fetchContestCoreBySlug(slug),
  })
}

export function prefetchPublicProfile(username: string): void {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.publicProfile(username),
    queryFn: () => fetchPublicProfilePageBundle(username),
  })
}

export function prefetchGamePage(slug: string): void {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.gamePage(slug),
    queryFn: () => fetchGamePageBundle(slug),
  })
}

export function prefetchOnIntent(handler: () => void): {
  onMouseEnter: () => void
  onFocus: () => void
} {
  return {
    onMouseEnter: handler,
    onFocus: handler,
  }
}
