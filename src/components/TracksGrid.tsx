import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { buildGameColumnTip, difficultyClass } from '../lib/resultsGrid'
import { difficulty } from '../lib/difficulty'
import { trackAppearanceDedupeKey } from '../lib/trackDisplay'
import type { TracksPageRow } from '../lib/queries/tracks'
import { ResultsGridHoverTip } from './ContestResultsGridHoverTip'

function TracksGridNavLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link className="results-cell-text results-game-link" to={to} onClick={(e) => e.stopPropagation()}>
      {children}
    </Link>
  )
}

function difficultyLabel(difficultyValue: string | null): string {
  const key = difficulty(difficultyValue)
  if (key === 'other') return difficultyValue?.trim() || '-'
  return key.charAt(0).toUpperCase() + key.slice(1)
}

function gameTitleKey(row: TracksPageRow): string {
  return row.primaryGameTitle.trim().toLocaleLowerCase()
}

function rowStripeClasses(rows: TracksPageRow[]): string[] {
  let stripeOdd = true
  let previousGameKey = ''
  return rows.map((row) => {
    const gameKey = gameTitleKey(row)
    if (gameKey !== previousGameKey) {
      if (previousGameKey !== '') stripeOdd = !stripeOdd
      previousGameKey = gameKey
    }
    return stripeOdd ? 'results-row-odd' : 'results-row-even'
  })
}

type TracksGridProps = {
  rows: TracksPageRow[]
  onPlayTrack?: (trackId: string) => void
}

export function TracksGrid({ rows, onPlayTrack }: TracksGridProps) {
  const rowClasses = useMemo(() => rowStripeClasses(rows), [rows])

  if (rows.length === 0) {
    return <p className="muted">No tracks to show yet.</p>
  }

  return (
    <div className="scoring-grid-root table-wrap results-grid-wrap tracks-grid-wrap grading-pivot-wrap--full grading-pivot-clip">
      <table className="dense results-unified-grid">
        <thead>
          <tr>
            <th className="results-col-game" scope="col">
              Game
            </th>
            <th className="results-col-song" scope="col">
              Track
            </th>
            <th className="results-col-contest" scope="col">
              Appeared In
            </th>
            <th className="results-col-stat" scope="col">
              # X
            </th>
            <th className="results-col-stat" scope="col">
              # ~
            </th>
            <th className="results-col-difficulty" scope="col">
              Difficulty
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const names = row.answer?.game_names ?? []
            const primaryGame = names[0] ?? 'N/A'
            const song = row.answer?.song_title?.trim() || 'N/A'
            const notes = row.answer?.notes?.trim() ?? ''
            const gameTip = buildGameColumnTip(names, row.gameTooltip)
            const gameSlug = row.gameTooltip?.primaryGameSlug?.trim()
            const rowClass = rowClasses[rowIndex]!

            const gameCell = gameSlug ? (
              <TracksGridNavLink to={`/games/${encodeURIComponent(gameSlug)}`}>{primaryGame}</TracksGridNavLink>
            ) : (
              <span className="results-cell-text">{primaryGame}</span>
            )

            return (
              <tr key={trackAppearanceDedupeKey(row.primaryGameTitle, row.track)} className={rowClass}>
                <td className="results-col-game results-stripe">
                  {gameTip ? <ResultsGridHoverTip content={gameTip}>{gameCell}</ResultsGridHoverTip> : gameCell}
                </td>
                <td
                  className={`results-col-song results-stripe${notes ? ' results-col-has-notes' : ''}${onPlayTrack ? ' results-col-song--playable' : ''}`}
                  onClick={onPlayTrack ? () => onPlayTrack(row.track.id) : undefined}
                  title={onPlayTrack ? 'Play this track in the player' : undefined}
                >
                  {notes ? (
                    <>
                      <ResultsGridHoverTip content={notes}>
                        <div className="tracks-grid-song-notes-hit" aria-hidden />
                      </ResultsGridHoverTip>
                      <span className="results-cell-text">{song}</span>
                      <span className="results-notes-corner" aria-hidden />
                    </>
                  ) : (
                    <span className="results-cell-text">{song}</span>
                  )}
                </td>
                <td className="results-col-contest results-stripe">
                  <span className="tracks-grid-contest-list">
                    {row.contests.map((contest) => (
                      <span key={contest.id} className="tracks-grid-contest-item">
                        <TracksGridNavLink to={`/contests/${encodeURIComponent(contest.slug)}`}>
                          {contest.title}
                        </TracksGridNavLink>
                      </span>
                    ))}
                  </span>
                </td>
                <td className="results-col-stat results-stripe">{row.correctGuesses}</td>
                <td className="results-col-stat results-stripe">{row.franchiseGuesses}</td>
                <td className={`results-col-difficulty ${difficultyClass(row.track.difficulty)}`}>
                  {difficultyLabel(row.track.difficulty)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
