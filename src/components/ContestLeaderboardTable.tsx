import { Link } from 'react-router-dom'
import type { ContestRankRow } from '../lib/scoring'

type Props = {
  rows: ContestRankRow[]
  profileUsernameByUserId?: Map<string, string>
}

const placeClasses = {
  0: 'rank-medal-gold',
  1: 'rank-medal-silver',
  2: 'rank-medal-bronze',
  default: '',
}

function RankNameCell({
  row,
  profileUsernameByUserId,
}: {
  row: ContestRankRow
  profileUsernameByUserId?: Map<string, string>
}) {
  const username = row.user_id ? profileUsernameByUserId?.get(row.user_id) : undefined
  if (!username) return row.name
  return (
    <Link className="results-game-link" to={`/players/${encodeURIComponent(username)}`}>
      {row.name}
    </Link>
  )
}

export function ContestLeaderboardTable({ rows, profileUsernameByUserId }: Props) {
  if (rows.length === 0) {
    return <p className="muted">No rankings yet.</p>
  }

  return (
    <div className="table-wrap">
      <table className="table rankings-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Score</th>
            <th>Correct games</th>
            <th>Correct franchise</th>
            <th>Solo guesses</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id} className={placeClasses[index as keyof typeof placeClasses]}>
              <td>{index + 1}</td>
              <td>
                <RankNameCell row={row} profileUsernameByUserId={profileUsernameByUserId} />
              </td>
              <td>{row.score.toFixed(1)}</td>
              <td>{row.correctGames}</td>
              <td>{row.correctFranchise}</td>
              <td>{row.solo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
