import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { pageTitle } from '../lib/pageTitle'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getSupabase } from '../lib/supabase'
import type { Contest } from '../lib/types'
import { contestClosed } from '../lib/deadline'

export function Home() {
  useDocumentTitle(pageTitle('Home'))
  const supabase = getSupabase()
  const { ready, userId, isAdmin } = useAuth()
  const [contests, setContests] = useState<Contest[]>([])
  const [modContestIds, setModContestIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!ready) return

    async function loadHomeData() {
      let moderatedContestIds = new Set<string>()
      if (userId) {
        const { data: moderatorRows } = await supabase
          .from('contest_moderators')
          .select('contest_id')
          .eq('user_id', userId)
        moderatedContestIds = new Set(
          (moderatorRows ?? []).map((row) => row.contest_id as string),
        )
      }
      setModContestIds(moderatedContestIds)

      const { data, error } = await supabase
        .from('contests')
        .select('*')
        .order('deadline', { ascending: false })
      if (error) {
        setContests([])
        return
      }
      setContests((data ?? []) as Contest[])
    }

    void loadHomeData()
  }, [supabase, ready, userId])

  const openContests = useMemo(
    () =>
      contests.filter(
        (contest) =>
          !contestClosed(contest.deadline) &&
          (contest.published || modContestIds.has(contest.id) || isAdmin),
      ),
    [contests, modContestIds, isAdmin],
  )

  return (
    <div className="page">
      <section className="hero site-announce">
        <h1>Video game music guessing contests</h1>
        <p className="lede">
          Name the game from 30-second song snippets! Active contests can be found below. The full archive lives on the
          Contests page. For updates when a new VGMGC goes live, join my{' '}
          <a href="https://discord.gg/sWyp79wUB" rel="noopener noreferrer" target="_blank">
            Discord
          </a>
          {' '}here.
        </p>
      </section>

      <section className="section">
        <h2>Current contests</h2>
        {openContests.length === 0 ? (
          <p className="muted">No open contests right now. Check back soon.</p>
        ) : (
          <ul className="card-list">
            {openContests.map((contest) => (
              <li key={contest.id} className="card">
                <Link to={`/contests/${contest.slug}`}>
                  <span className="card-title">{contest.title}</span>
                  <span className="muted small">Deadline {new Date(contest.deadline).toLocaleString()}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="muted small">
        <Link to="/contests">Browse all contests</Link>
      </p>
    </div>
  )
}
