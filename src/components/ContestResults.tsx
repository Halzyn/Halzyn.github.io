import { ContestLeaderboardTable } from './ContestLeaderboardTable'
import { ContestResultsGrid } from './ContestResultsGrid'
import type { ContestRankRow } from '../lib/scoring'
import type { GameTooltip } from '../lib/gameTooltip'
import type { DisplayNameStyleInfo } from '../lib/displayNameStyle'
import type { GradingMark, Submission, Track, TrackAnswer } from '../lib/types'

export type { ContestRankRow as LeaderboardRow }

type Props = {
  tracks: Track[]
  answers: TrackAnswer[]
  submissions: Submission[]
  marks: GradingMark[]
  leaderboard: ContestRankRow[]
  gameTooltips?: Record<string, GameTooltip>
  onPlayTrack?: (trackId: string) => void
  displayNameByUserId?: Map<string, string>
  profileUsernameByUserId?: Map<string, string>
  displayNameStyleByUserId?: Map<string, DisplayNameStyleInfo>
}

export function ContestResults({
  tracks,
  answers,
  submissions,
  marks,
  leaderboard,
  gameTooltips,
  onPlayTrack,
  displayNameByUserId,
  profileUsernameByUserId,
  displayNameStyleByUserId,
}: Props) {
  return (
    <section className="section contest-results-section">
      <h2>Results</h2>
      <p className="muted small contest-results-intro">
        SPOILERS AHEAD!
      </p>
      <details className="spoiler spoiler-all">
        <summary className="spoiler-all-summary">Show results and rankings</summary>
        <div className="reveal-bundle">
          <h3 className="reveal-subhead">Tracks &amp; scores</h3>
          <ContestResultsGrid
            tracks={tracks}
            answers={answers}
            submissions={submissions}
            marks={marks}
            gameTooltips={gameTooltips}
            onPlayTrack={onPlayTrack}
            displayNameByUserId={displayNameByUserId}
            profileUsernameByUserId={profileUsernameByUserId}
            displayNameStyleByUserId={displayNameStyleByUserId}
          />

          <h3 className="reveal-subhead">Rankings</h3>
          <ContestLeaderboardTable
            rows={leaderboard}
            profileUsernameByUserId={profileUsernameByUserId}
            displayNameStyleByUserId={displayNameStyleByUserId}
          />
        </div>
      </details>
    </section>
  )
}
