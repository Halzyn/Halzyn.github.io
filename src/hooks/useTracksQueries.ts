import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { fetchTracksPageBundle } from '../lib/queries/tracks'
import { queryKeys } from '../lib/queries/keys'

export function useTracksPage() {
  const { profileReady, userId } = useAuth()
  const viewerKey = userId ?? 'anon'

  return useQuery({
    queryKey: queryKeys.tracksPage(viewerKey),
    queryFn: fetchTracksPageBundle,
    enabled: profileReady,
  })
}
