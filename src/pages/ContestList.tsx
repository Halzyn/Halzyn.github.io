import { pageTitle } from '../lib/pageTitle'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useContests } from '../hooks/useContests'
import { ContestCard } from '../components/ContestCard'

export function ContestList() {
  useDocumentTitle(pageTitle('Contests'))
  const { contests, hostsByContestId, loadError } = useContests()

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
