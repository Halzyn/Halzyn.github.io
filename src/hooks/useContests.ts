import { useEffect, useMemo, useState } from 'react'
import { CONTEST_HOST_EMBED_SELECT, hostsMapFromContests } from '../lib/contestHosts'
import { getSupabase } from '../lib/supabase'
import type { ContestWithHosts } from '../lib/types'

export function useContests() {
  const supabase = getSupabase()
  const [contests, setContests] = useState<ContestWithHosts[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoadError(null)
      setLoading(true)
      const { data, error } = await supabase
        .from('contests')
        .select(`*, ${CONTEST_HOST_EMBED_SELECT}`)
        .order('deadline', { ascending: false })
      if (cancelled) return
      if (error) {
        setLoadError(error.message)
        setContests([])
      } else {
        setContests((data ?? []) as ContestWithHosts[])
      }
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const hostsByContestId = useMemo(() => hostsMapFromContests(contests), [contests])

  return { contests, hostsByContestId, loadError, loading }
}
