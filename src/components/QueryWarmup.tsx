import { useEffect } from 'react'
import { prefetchCoreAppQueries } from '../lib/queryPrefetch'

export function QueryWarmup() {
  useEffect(() => {
    prefetchCoreAppQueries()
  }, [])

  return null
}
