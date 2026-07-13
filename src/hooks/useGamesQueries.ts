import { useQuery } from '@tanstack/react-query'
import { fetchGamesCatalog, fetchGamePageBundle } from '../lib/queries/games'
import { queryKeys } from '../lib/queries/keys'

export function useGamesCatalog() {
  return useQuery({
    queryKey: queryKeys.gamesCatalog,
    queryFn: fetchGamesCatalog,
  })
}

export function useGamePage(slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.gamePage(slug ?? ''),
    queryFn: () => fetchGamePageBundle(slug!),
    enabled: Boolean(slug),
  })
}
