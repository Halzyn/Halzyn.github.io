import { useEffect, useMemo, useState } from 'react'
import { pageTitle } from '../lib/pageTitle'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getSupabase } from '../lib/supabase'
import { CONTEST_HOST_EMBED_SELECT, hostsMapFromContests } from '../lib/contestHosts'
import { ContestCard } from '../components/ContestCard'
import type { ContestWithHosts } from '../lib/types'

export function ContestList() {
  useDocumentTitle(pageTitle('Contests'))
  const supabase = getSupabase()
  const [contests, setContests] = useState<ContestWithHosts[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    async function loadContests() {
      setLoadError(null)
      const { data, error } = await supabase
        .from('contests')
        .select(`*, ${CONTEST_HOST_EMBED_SELECT}`)
        .order('deadline', {
          ascending: false,
        })
      if (error) {
        setLoadError(error.message)
        setContests([])
        return
      }
      setContests((data ?? []) as ContestWithHosts[])
    }
    void loadContests()
  }, [supabase])

  const hostsByContestId = useMemo(() => hostsMapFromContests(contests), [contests])
  return (
    <div className="page">
      <h1 className="visually-hidden">Contests</h1>
      {loadError ? <p className="banner warn">{loadError}</p> : null}
      <section className="section">
        <h2>Contest archive</h2>
        <ul className="card-list">
          {contests.map((contest) => (
            <ContestCard
              key={contest.id}
              slug={contest.slug}
              contestId={contest.id}
              title={contest.title}
              deadline={contest.deadline}
              hosts={hostsByContestId.get(contest.id)}
              showStatusPill
            />
          ))}
        </ul>
      </section>
    </div>
  )
}
