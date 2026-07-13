import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { pageTitle } from '../lib/pageTitle'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getSupabase } from '../lib/supabase'
import { CONTEST_HOST_EMBED_SELECT, hostsMapFromContests } from '../lib/contestHosts'
import { ContestCalendarLink } from '../components/ContestCalendarLink'
import { ContestTitleWithHosts } from '../components/ContestTitleWithHosts'
import type { ContestWithHosts } from '../lib/types'
import { contestClosed } from '../lib/deadline'

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
          {contests.map((contest) => {
            const open = !contestClosed(contest.deadline)
            return (
              <li key={contest.id} className="card">
                <Link to={`/contests/${contest.slug}`}>
                  <span className="contest-card-head">
                    <ContestTitleWithHosts
                      title={contest.title}
                      hosts={hostsByContestId.get(contest.id)}
                      hostsNestedInLink
                    />
                    <span className="pill">{open ? 'Open' : 'Closed'}</span>
                  </span>
                  <span className="muted small contest-card-deadline">
                    {open ? 'Deadline' : 'Concluded'} {new Date(contest.deadline).toLocaleString()}
                    {open ? (
                      <>
                        {' ◦ '}
                        <ContestCalendarLink
                          contestId={contest.id}
                          contestSlug={contest.slug}
                          contestTitle={contest.title}
                          deadlineIso={contest.deadline}
                          events={['deadline']}
                        />
                      </>
                    ) : null}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
