import { useMemo, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { GradingMark, Submission, Track, TrackAnswer } from '../lib/types'
import {
  buildGameColumnTip,
  difficultyClass,
  gradeCell,
  markMapFromMarks,
} from '../lib/resultsGrid'
import {
  soloGameWinnerByTrack,
  sortSubmissionsByContestRank,
  submissionDisplayNameForRank,
} from '../lib/scoring'
import type { GameTooltip } from '../lib/gameTooltip'
import type { DisplayNameStyleInfo } from '../lib/displayNameStyle'
import {
  resolveChosenHostEntry,
  type ContestHostDisplayEntry,
  type ContestHosts,
} from '../lib/contestHosts'
import { useResultsGridStickyLead } from '../hooks/useResultsGridStickyLead'
import {
  resultsColClass,
  useCollapsibleResultsColumns,
} from '../hooks/useCollapsibleResultsColumns'
import { ResultsGridHoverTip } from './ContestResultsGridHoverTip'
import { ResultsColCollapseBtn } from './ResultsColCollapseBtn'
import { ContestHostName } from './ContestHostName'
import { DisplayNameStyled } from './DisplayNameStyled'
import { LoadingState } from './LoadingState'

function ResultsGridNavLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link className="results-cell-text results-game-link" to={to} onClick={(e) => e.stopPropagation()}>
      {children}
    </Link>
  )
}

type TrackRowProps = {
  track: Track
  rowIndex: number
  answer: TrackAnswer | undefined
  tooltip: GameTooltip | undefined
  markMap: Map<string, 'game' | 'franchise'>
  soloByTrack: Map<string, string>
  submissionsRanked: Submission[]
  showHostColumn: boolean
  hostEntry: ContestHostDisplayEntry | null
  hostStyleInfo?: DisplayNameStyleInfo | null
  collapsed: ReadonlySet<string>
  onPlayTrack?: (trackId: string) => void
}

function ContestResultsTrackRow({
  track,
  rowIndex,
  answer,
  tooltip,
  markMap,
  soloByTrack,
  submissionsRanked,
  showHostColumn,
  hostEntry,
  hostStyleInfo,
  collapsed,
  onPlayTrack,
}: TrackRowProps) {
  const names = answer?.game_names ?? []
  const primaryGame = names[0] ?? 'N/A'
  const song = answer?.song_title?.trim() || 'N/A'
  const notes = answer?.notes?.trim() ?? ''
  const rowClass = rowIndex % 2 === 0 ? 'results-row-odd' : 'results-row-even'
  const gameTip = buildGameColumnTip(names, tooltip)
  const gameSlug = tooltip?.primaryGameSlug?.trim()

  const gameCell = gameSlug ? (
    <ResultsGridNavLink to={`/games/${encodeURIComponent(gameSlug)}`}>{primaryGame}</ResultsGridNavLink>
  ) : (
    <span className="results-cell-text">{primaryGame}</span>
  )

  return (
    <tr className={rowClass}>
      <td
        className={`results-col-number ${difficultyClass(track.difficulty)}${notes ? ' results-col-has-notes' : ''}`}
      >
        {notes ? (
          <>
            <ResultsGridHoverTip content={notes}>
              <div className="results-num-hit" aria-hidden />
            </ResultsGridHoverTip>
            <span className="results-num-value">{track.sort_order}</span>
            <span className="results-notes-corner" aria-hidden />
          </>
        ) : (
          <span className="results-num-value">{track.sort_order}</span>
        )}
      </td>
      {showHostColumn ? (
        <td className={resultsColClass('results-col-host', collapsed.has('host'), 'results-stripe')}>
          {hostEntry ? (
            <ContestHostName
              displayName={hostEntry.displayName}
              profileUsername={hostEntry.profileUsername}
              styleInfo={hostStyleInfo}
            />
          ) : (
            <span className="results-cell-text">—</span>
          )}
        </td>
      ) : null}
      <td className={resultsColClass('results-col-game', collapsed.has('game'), 'results-stripe')}>
        {gameTip ? <ResultsGridHoverTip content={gameTip}>{gameCell}</ResultsGridHoverTip> : gameCell}
      </td>
      <td
        className={resultsColClass(
          'results-col-song',
          collapsed.has('song'),
          `results-stripe${onPlayTrack ? ' results-col-song--playable' : ''}`,
        )}
        onClick={onPlayTrack && !collapsed.has('song') ? () => onPlayTrack(track.id) : undefined}
        title={onPlayTrack && !collapsed.has('song') ? 'Play this track in the player' : undefined}
      >
        <span className="results-cell-text">{song}</span>
      </td>
      <td className="results-col-separator" aria-hidden />
      {submissionsRanked.map((submission) => {
        const grade = gradeCell(markMap, soloByTrack, submission.id, track.id)
        return (
          <td
            key={submission.id}
            className={`results-col-grade${grade ? ` ${grade.cellClass}` : ' results-stripe'}`}
          >
            {grade ? (
              <span className="results-grade-char" aria-hidden>
                {grade.text}
              </span>
            ) : null}
          </td>
        )
      })}
    </tr>
  )
}

type ResultsGridProps = {
  tracks: Track[]
  answers: TrackAnswer[]
  submissions: Submission[]
  marks: GradingMark[]
  gameTooltips?: Record<string, GameTooltip>
  onPlayTrack?: (trackId: string) => void
  displayNameByUserId?: Map<string, string>
  profileUsernameByUserId?: Map<string, string>
  displayNameStyleByUserId?: Map<string, DisplayNameStyleInfo>
  contestHosts?: ContestHosts
}

export function ContestResultsGrid({
  tracks,
  answers,
  submissions,
  marks,
  gameTooltips,
  onPlayTrack,
  displayNameByUserId,
  profileUsernameByUserId,
  displayNameStyleByUserId,
  contestHosts,
}: ResultsGridProps) {
  const showHostColumn = (contestHosts?.entries.length ?? 0) > 1
  const stickyColCount = showHostColumn ? 5 : 4
  const { collapsed, isCollapsed, toggle, layoutKey: collapseLayoutKey } =
    useCollapsibleResultsColumns()
  const gridScrollRef = useRef<HTMLDivElement>(null)
  useResultsGridStickyLead(
    gridScrollRef,
    `${tracks.length}-${submissions.length}-${stickyColCount}-${collapseLayoutKey}`,
    stickyColCount,
  )

  const byTrack = useMemo(() => new Map(answers.map((a) => [a.track_id, a])), [answers])
  const markMap = useMemo(() => markMapFromMarks(marks), [marks])
  const soloByTrack = useMemo(() => soloGameWinnerByTrack(marks), [marks])
  const trackOrder = useMemo(() => tracks.map((t) => t.id), [tracks])

  const submissionsRanked = useMemo(
    () => sortSubmissionsByContestRank(submissions, trackOrder, marks, tracks, displayNameByUserId),
    [submissions, trackOrder, marks, tracks, displayNameByUserId],
  )

  if (tracks.length === 0) {
    return <LoadingState label="Loading tracks..." />
  }

  return (
    <div
      ref={gridScrollRef}
      className={`scoring-grid-root table-wrap results-grid-wrap grading-pivot-wrap--full grading-pivot-clip${showHostColumn ? ' results-grid--with-host' : ''}`}
    >
      <table className="dense results-unified-grid">
        <thead>
          <tr>
            <th className="results-col-number" scope="col">
              #
            </th>
            {showHostColumn ? (
              <th className={resultsColClass('results-col-host', isCollapsed('host'))} scope="col">
                <div className="results-col-head">
                  <ResultsColCollapseBtn
                    columnKey="host"
                    label="By"
                    collapsed={isCollapsed('host')}
                    onToggle={toggle}
                  />
                  {!isCollapsed('host') ? <span className="results-col-head-label">By</span> : null}
                </div>
              </th>
            ) : null}
            <th className={resultsColClass('results-col-game', isCollapsed('game'))} scope="col">
              <div className="results-col-head">
                <ResultsColCollapseBtn
                  columnKey="game"
                  label="Game"
                  collapsed={isCollapsed('game')}
                  onToggle={toggle}
                />
                {!isCollapsed('game') ? <span className="results-col-head-label">Game</span> : null}
              </div>
            </th>
            <th className={resultsColClass('results-col-song', isCollapsed('song'))} scope="col">
              <div className="results-col-head">
                <ResultsColCollapseBtn
                  columnKey="song"
                  label="Title"
                  collapsed={isCollapsed('song')}
                  onToggle={toggle}
                />
                {!isCollapsed('song') ? <span className="results-col-head-label">Title</span> : null}
              </div>
            </th>
            <th className="results-col-separator" scope="col" aria-hidden />
            {submissionsRanked.map((s) => {
              const label = submissionDisplayNameForRank(s, displayNameByUserId)
              const uname = s.user_id ? profileUsernameByUserId?.get(s.user_id) : undefined
              const nameStyleInfo = s.user_id ? displayNameStyleByUserId?.get(s.user_id) : undefined
              return (
                <th key={s.id} className="results-col-grade" scope="col">
                  {uname ? (
                    <ResultsGridNavLink to={`/players/${encodeURIComponent(uname)}`}>
                      <DisplayNameStyled text={label} info={nameStyleInfo} />
                    </ResultsGridNavLink>
                  ) : (
                    <DisplayNameStyled text={label} info={nameStyleInfo} />
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {tracks.map((track, rowIndex) => {
            const hostEntry = contestHosts
              ? resolveChosenHostEntry(track.chosen_by_host_key, contestHosts)
              : null
            const hostStyleInfo = hostEntry?.profileUserId
              ? contestHosts?.styles.get(hostEntry.profileUserId) ?? null
              : null
            return (
              <ContestResultsTrackRow
                key={track.id}
                track={track}
                rowIndex={rowIndex}
                answer={byTrack.get(track.id)}
                tooltip={gameTooltips?.[track.id]}
                markMap={markMap}
                soloByTrack={soloByTrack}
                submissionsRanked={submissionsRanked}
                showHostColumn={showHostColumn}
                hostEntry={hostEntry}
                hostStyleInfo={hostStyleInfo}
                collapsed={collapsed}
                onPlayTrack={onPlayTrack}
              />
            )
          })}
        </tbody>
      </table>
      {submissionsRanked.length === 0 ? (
        <p className="muted small results-grid-foot">No submissions for this contest yet.</p>
      ) : null}
    </div>
  )
}
