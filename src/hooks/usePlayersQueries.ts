import { useQuery } from '@tanstack/react-query'
import {
  fetchPlayersPublicBundle,
  fetchPublicProfilePageBundle,
  fetchSiteHostBundle,
} from '../lib/queries/players'
import { queryKeys } from '../lib/queries/keys'

export function usePlayersPublic() {
  return useQuery({
    queryKey: queryKeys.playersPublic,
    queryFn: fetchPlayersPublicBundle,
  })
}

export function usePublicProfile(username: string | undefined) {
  return useQuery({
    queryKey: queryKeys.publicProfile(username ?? ''),
    queryFn: () => fetchPublicProfilePageBundle(username!),
    enabled: Boolean(username),
  })
}

export function useSiteHost() {
  return useQuery({
    queryKey: queryKeys.siteHost,
    queryFn: fetchSiteHostBundle,
  })
}
