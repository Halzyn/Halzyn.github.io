import { Link } from 'react-router-dom'
import type { ContestRankRow } from '../lib/scoring'
import type { DisplayNameStyleInfo } from '../lib/displayNameStyle'
import { DisplayNameStyled } from './DisplayNameStyled'

type Props = {
  rows: ContestRankRow[]
  profileUsernameByUserId?: Map<string, string>
  displayNameStyleByUserId?: Map<string, DisplayNameStyleInfo>
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
  displayNameStyleByUserId,
}: {
  row: ContestRankRow
  profileUsernameByUserId?: Map<string, string>
  displayNameStyleByUserId?: Map<string, DisplayNameStyleInfo>
}) {
  const username = row.user_id ? profileUsernameByUserId?.get(row.user_id) : undefined
  const info = row.user_id ? displayNameStyleByUserId?.get(row.user_id) : undefined
  if (!username) {
    return <DisplayNameStyled text={row.name} info={info} />
  }
  return (
    <Link className="results-game-link" to={`/players/${encodeURIComponent(username)}`}>
      <DisplayNameStyled text={row.name} info={info} />
    </Link>
  )
}

export function ContestLeaderboardTable({
  rows,
  profileUsernameByUserId,
  displayNameStyleByUserId,
}: Props) {
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
                <RankNameCell
                  row={row}
                  profileUsernameByUserId={profileUsernameByUserId}
                  displayNameStyleByUserId={displayNameStyleByUserId}
                />
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
