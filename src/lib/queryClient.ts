import { QueryClient } from '@tanstack/react-query'

const PUBLIC_DATA_STALE_MS = 5 * 60_000

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: PUBLIC_DATA_STALE_MS,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
})
