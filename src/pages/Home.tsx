import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { pageTitle } from '../lib/pageTitle'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getSupabase } from '../lib/supabase'
import {
  CONTEST_HOST_EMBED_SELECT,
  contestHostsFromScheduledTeaser,
  hostsMapFromContests,
} from '../lib/contestHosts'
import { ContestTitleWithHosts } from '../components/ContestTitleWithHosts'
import type { ContestWithHosts, ScheduledContestTeaser } from '../lib/types'
import { contestClosed } from '../lib/deadline'

export function Home() {
  useDocumentTitle(pageTitle('Home'))
  const supabase = getSupabase()
  const { ready, userId, isAdmin } = useAuth()
  const [contests, setContests] = useState<ContestWithHosts[]>([])
  const [scheduledTeasers, setScheduledTeasers] = useState<ScheduledContestTeaser[]>([])
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

      const [contestsResult, teaserResult] = await Promise.all([
        supabase.from('contests').select(`*, ${CONTEST_HOST_EMBED_SELECT}`).order('deadline', { ascending: false }),
        supabase.rpc('scheduled_contests_teaser'),
      ])

      const contestList = (contestsResult.error ? [] : (contestsResult.data ?? [])) as ContestWithHosts[]
      const teaserList = (teaserResult.error ? [] : (teaserResult.data ?? [])) as ScheduledContestTeaser[]

      setContests(contestList)
      setScheduledTeasers(teaserList)
    }

    void loadHomeData()
  }, [supabase, ready, userId, isAdmin])

  const hostsByContestId = useMemo(() => hostsMapFromContests(contests), [contests])

  const openContests = useMemo(
    () =>
      contests.filter(
        (contest) =>
          !contestClosed(contest.deadline) &&
          (contest.published || modContestIds.has(contest.id) || isAdmin),
      ),
    [contests, modContestIds, isAdmin],
  )

  const showCurrentContests =
    scheduledTeasers.length <= 0 || (scheduledTeasers.length > 0 && openContests.length > 0)
  const showScheduledContests = scheduledTeasers.length > 0

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

      {showCurrentContests && (<section className="section">
        <h2>Current contests</h2>
        {openContests.length === 0 ? (
          <p className="muted">No open contests right now. Check back soon.</p>
        ) : (
          <ul className="card-list">
            {openContests.map((contest) => (
              <li key={contest.id} className="card">
                <Link to={`/contests/${contest.slug}`}>
                  <ContestTitleWithHosts
                    title={contest.title}
                    hosts={hostsByContestId.get(contest.id)}
                    hostsNestedInLink
                  />
                  <span className="muted small contest-card-deadline">
                    Deadline {new Date(contest.deadline).toLocaleString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>)}

      {showScheduledContests && (
        <section className="section">
          <h2>Coming soon</h2>
          <ul className="scheduled-contest-list">
            {scheduledTeasers.map((row) => {
              const liveAt = row.scheduled_publish_at
              return (
                <li key={row.id} className="scheduled-contest-item">
                  <ContestTitleWithHosts
                    title={row.title}
                    hosts={contestHostsFromScheduledTeaser(row)}
                    titleClassName="scheduled-contest-title"
                  />
                  {liveAt ? (
                    <span className="muted small scheduled-contest-live">
                      Goes live {new Date(liveAt).toLocaleString()}
                    </span>
                  ) : null}
                  {row.schedule_tagline?.trim() ? (
                    <p className="scheduled-contest-tagline">{row.schedule_tagline.trim()}</p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <p className="muted small">
        <Link to="/contests">Browse all contests</Link>
      </p>
    </div>
  )
}
