import { contestsListMeta } from '../lib/siteMeta'
import { usePageMeta } from '../hooks/usePageMeta'
import { useContests } from '../hooks/useContests'
import { ContestCard } from '../components/ContestCard'
import { LoadingState } from '../components/LoadingState'

export function ContestList() {
  const { contests, hostsByContestId, loadError, loading } = useContests()
  usePageMeta(contestsListMeta(contests.length))

  return (
    <div className="page">
      <h1 className="visually-hidden">Contests</h1>
      {loadError ? <p className="banner warn">{loadError}</p> : null}
      <section className="section">
        <h2>Contest archive</h2>
        {loading ? (
          <LoadingState label="Loading contests..." />
        ) : contests.length === 0 ? (
          <p className="muted">No contests yet.</p>
        ) : (
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
        )}
      </section>
    </div>
  )
}
