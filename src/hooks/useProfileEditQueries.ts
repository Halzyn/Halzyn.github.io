import { useQuery } from '@tanstack/react-query'
import {
  fetchFavoriteSoundtrackGames,
  fetchMyContestSubmissions,
  fetchProfileNameStyleCaps,
} from '../lib/queries/profile'
import { queryKeys } from '../lib/queries/keys'

export function useProfileNameStyleCaps(profileId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.profileNameStyleCaps(profileId ?? ''),
    queryFn: fetchProfileNameStyleCaps,
    enabled: Boolean(profileId),
  })
}

export function useMyContestSubmissions(profileId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.myContestSubmissions(profileId ?? ''),
    queryFn: fetchMyContestSubmissions,
    enabled: Boolean(profileId),
  })
}

export function useFavoriteSoundtrackGames(profileId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.favoriteSoundtrackGames(profileId ?? ''),
    queryFn: fetchFavoriteSoundtrackGames,
    enabled: Boolean(profileId),
  })
}
