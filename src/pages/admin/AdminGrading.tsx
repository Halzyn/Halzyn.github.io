import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getSupabase } from '../../lib/supabase'
import type { Contest, GradingMark, Submission, SubmissionGuess, Track, TrackAnswer } from '../../lib/types'
import { parseTrackAnswer } from '../../lib/trackAnswer'
import { pageTitle } from '../../lib/pageTitle'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { difficultyClass, gradeCell, markMapFromMarks } from '../../lib/resultsGrid'
import { buildContestRankRows, soloGameWinnerByTrack, sortSubmissionsByContestRank } from '../../lib/scoring'
import { useResultsGridStickyLead } from '../../hooks/useResultsGridStickyLead'

type Mark = 'game' | 'franchise' | null

const MARK_CYCLE: Mark[] = [null, 'game', 'franchise']

function rankMedalRowClass(rankIndex: number): string {
  if (rankIndex === 0) return 'rank-medal-gold'
  if (rankIndex === 1) return 'rank-medal-silver'
  if (rankIndex === 2) return 'rank-medal-bronze'
  return ''
}

export function AdminGrading() {
  const supabase = getSupabase()
  const { id: contestId } = useParams()
  const [contest, setContest] = useState<Contest | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [guesses, setGuesses] = useState<SubmissionGuess[]>([])
  const [marks, setMarks] = useState<GradingMark[]>([])
  const [answers, setAnswers] = useState<TrackAnswer[]>([])
  const [pageError, setPageError] = useState<string | null>(null)
  const [newContestantName, setNewContestantName] = useState('')
  const [addingContestant, setAddingContestant] = useState(false)

  const gridScrollRef = useRef<HTMLDivElement>(null)
  useResultsGridStickyLead(gridScrollRef, `${tracks.length}-${submissions.length}`)

  const reloadGradingData = useCallback(async () => {
    if (!contestId) return
    setPageError(null)

    const [
      { data: contestRow, error: contestError },
      { data: trackRows },
      { data: submissionRows },
    ] = await Promise.all([
      supabase.from('contests').select('*').eq('id', contestId).single(),
      supabase
        .from('tracks')
        .select('*')
        .eq('contest_id', contestId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('submissions')
        .select('*')
        .eq('contest_id', contestId)
        .order('created_at', { ascending: true }),
    ])

    if (contestError || !contestRow) {
      setContest(null)
      setPageError(contestError?.message ?? 'Not found')
      return
    }

    setContest(contestRow as Contest)

    const trackList = (trackRows ?? []) as Track[]
    const submissionList = (submissionRows ?? []) as Submission[]
    setTracks(trackList)
    setSubmissions(submissionList)

    const submissionIds = submissionList.map((s) => s.id)
    const trackIds = trackList.map((t) => t.id)

    const [guessesResult, marksResult, answersResult] = await Promise.all([
      submissionIds.length > 0
        ? supabase.from('submission_guesses').select('*').in('submission_id', submissionIds)
        : Promise.resolve({ data: [] as SubmissionGuess[] }),
      trackIds.length > 0
        ? supabase.from('grading_marks').select('*').in('track_id', trackIds)
        : Promise.resolve({ data: [] as GradingMark[] }),
      trackIds.length > 0
        ? supabase.from('track_answers').select('*').in('track_id', trackIds)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ])

    setGuesses((guessesResult.data ?? []) as SubmissionGuess[])
    setMarks((marksResult.data ?? []) as GradingMark[])
    setAnswers((answersResult.data ?? []).map((row) => parseTrackAnswer(row)))
  }, [contestId, supabase])

  useEffect(() => {
    void reloadGradingData()
  }, [reloadGradingData])

  const gradingDocTitle = useMemo(
    () => (contest ? pageTitle('Grading', contest.title) : pageTitle('Grading')),
    [contest],
  )

  useDocumentTitle(gradingDocTitle)

  const markMap = useMemo(() => markMapFromMarks(marks), [marks])

  const soloByTrack = useMemo(() => soloGameWinnerByTrack(marks), [marks])

  const trackIds = useMemo(() => tracks.map((track) => track.id), [tracks])

  const contestRankRows = useMemo(
    () => buildContestRankRows(submissions, trackIds, marks, tracks),
    [submissions, marks, trackIds, tracks],
  )

  const submissionsForGrid = useMemo(
    () => sortSubmissionsByContestRank(submissions, trackIds, marks, tracks),
    [submissions, trackIds, marks, tracks],
  )

  const submissionById = useMemo(() => new Map(submissions.map((submission) => [submission.id, submission])), [submissions])

  const guessBySubmissionTrack = useMemo(() => {
    const map = new Map<string, string>()
    for (const guess of guesses) {
      map.set(`${guess.submission_id}:${guess.track_id}`, guess.guess_text ?? '')
    }
    return map
  }, [guesses])

  const answersByTrack = useMemo(() => new Map(answers.map((answer) => [answer.track_id, answer])), [answers])

  function getMark(submissionId: string, trackId: string): Mark {
    return markMap.get(`${submissionId}:${trackId}`) ?? null
  }

  async function setMark(submissionId: string, trackId: string, next: Mark) {
    if (next === null) {
      await supabase.from('grading_marks').delete().match({ submission_id: submissionId, track_id: trackId })
    } else {
      await supabase.from('grading_marks').upsert(
        { submission_id: submissionId, track_id: trackId, mark: next },
        { onConflict: 'submission_id,track_id' },
      )
    }
    void reloadGradingData()
  }

  function cycleMark(submissionId: string, trackId: string) {
    const current = getMark(submissionId, trackId)
    const index = MARK_CYCLE.indexOf(current)
    const nextIndex = index === -1 ? 0 : (index + 1) % MARK_CYCLE.length
    void setMark(submissionId, trackId, MARK_CYCLE[nextIndex]!)
  }

  async function removeSubmission(submissionId: string) {
    if (
      !window.confirm(
        'Delete this submission permanently? All guesses and grades for this contestant will be removed.',
      )
    ) {
      return
    }
    setPageError(null)
    const { error } = await supabase.from('submissions').delete().eq('id', submissionId)
    if (error) {
      setPageError(error.message)
      return
    }
    void reloadGradingData()
  }

  async function addContestant(event: FormEvent) {
    event.preventDefault()
    if (!contest) return
    const name = newContestantName.trim()
    if (!name) {
      setPageError('Enter a contestant name.')
      return
    }
    setAddingContestant(true)
    setPageError(null)
    const { error } = await supabase.rpc('admin_add_contestant', {
      p_contest_id: contest.id,
      p_contestant_name: name,
    })
    setAddingContestant(false)
    if (error) {
      setPageError(error.message)
      return
    }
    setNewContestantName('')
    void reloadGradingData()
  }

  if (!contestId) return null
  if (pageError && !contest) return <p className="banner warn">{pageError}</p>
  if (!contest) return <p className="muted">Loading...</p>

  return (
    <div className="page wide">
      <p className="muted small">
        <Link to={`/admin/contests/${contest.id}`}>← Contest</Link>
      </p>
      <h1>Grading — {contest.title}</h1>
      <p className="muted small">
        Each row is a track and each column is a contestant. Click a cell
        to toggle between X (correct game), ~ (franchise only) and
        empty. If someone sends you a submission in private through Discord, you can add them to the grid with the form below.
      </p>
      {pageError ? <p className="banner warn">{pageError}</p> : null}

      <section className="section">
        <h2>Add contestant to grid</h2>
        <form className="form row-form" onSubmit={addContestant}>
          <label className="field grow">
            <span>Name</span>
            <input
              value={newContestantName}
              onChange={(event) => setNewContestantName(event.target.value)}
              maxLength={80}
              placeholder="Manual entry"
            />
          </label>
          <button type="submit" className="button primary" disabled={addingContestant}>
            {addingContestant ? 'Adding...' : 'Add to grid'}
          </button>
        </form>
      </section>

      <section className="section">
        <h2>Score preview</h2>
        {submissions.length === 0 ? (
          <p className="muted">Add at least one contestant to see scores.</p>
        ) : (
          <div className="table-wrap">
            <table className="table rankings-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Review</th>
                  <th>Score</th>
                  <th>Correct games</th>
                  <th>Correct franchise</th>
                  <th>Solo</th>
                </tr>
              </thead>
              <tbody>
                {contestRankRows.map((row, rankIndex) => {
                  const reviewed =
                    (submissionById.get(row.id)?.review_status ?? 'open') === 'reviewed'
                  return (
                    <tr key={row.id} className={rankMedalRowClass(rankIndex)}>
                      <td>{rankIndex + 1}</td>
                      <td>{row.name}</td>
                      <td>{reviewed ? 'Reviewed' : 'Open'}</td>
                      <td>{row.score.toFixed(1)}</td>
                      <td>{row.correctGames}</td>
                      <td>{row.correctFranchise}</td>
                      <td>{row.solo}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <h2>Grid</h2>
        {tracks.length === 0 ? (
          <p className="muted">No tracks yet.</p>
        ) : submissions.length === 0 ? (
          <p className="muted">No contestants yet.</p>
        ) : (
          <div
            ref={gridScrollRef}
            className="scoring-grid-root table-wrap scroll grading-pivot-wrap results-grid-sticky-lead"
          >
            <table className="dense results-unified-grid">
              <thead>
                <tr>
                  <th className="results-col-number" scope="col">
                    #
                  </th>
                  <th className="results-col-game" scope="col">
                    Game
                  </th>
                  <th className="results-col-song" scope="col">
                    Title
                  </th>
                  <th className="results-col-separator" scope="col" aria-hidden />
                  {submissionsForGrid.map((submission) => (
                    <th key={submission.id} className="results-col-grade" scope="col">
                      <div className="results-head-name">{submission.contestant_name}</div>
                      <button
                        type="button"
                        className="button ghost small grading-remove-submission"
                        onClick={() => void removeSubmission(submission.id)}
                      >
                        Delete submission
                      </button>
                      <div className="results-head-sub">{new Date(submission.created_at).toLocaleString()}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tracks.map((track, rowIdx) => {
                  const rowClass = rowIdx % 2 === 0 ? 'results-row-odd' : 'results-row-even'
                  const trackAnswer = answersByTrack.get(track.id)
                  const gameNames = trackAnswer?.game_names ?? []
                  const primaryGame = gameNames[0] ?? '—'
                  const songTitle = trackAnswer?.song_title?.trim() || '—'
                  const alternateGamesTooltip =
                    gameNames.length > 1 ? gameNames.slice(1).join(', ') : undefined
                  return (
                    <tr key={track.id} className={rowClass}>
                      <td className={`results-col-number ${difficultyClass(track.difficulty)}`}>
                        <span className="results-num-value">{track.sort_order}</span>
                      </td>
                      <td className="results-col-game results-stripe">
                        <span className="results-cell-text" title={alternateGamesTooltip}>
                          {primaryGame}
                        </span>
                      </td>
                      <td className="results-col-song results-stripe">
                        <span className="results-cell-text">{songTitle}</span>
                      </td>
                      <td className="results-col-separator" aria-hidden />
                      {submissionsForGrid.map((submission) => {
                        const mark = getMark(submission.id, track.id)
                        const markVisual = gradeCell(markMap, soloByTrack, submission.id, track.id)
                        const gradeLabel = mark === 'game' ? 'X' : mark === 'franchise' ? '~' : '·'
                        const guessText =
                          guessBySubmissionTrack.get(`${submission.id}:${track.id}`) ?? ''
                        const stripeClass = markVisual ? markVisual.cellClass : 'results-stripe'
                        return (
                          <td key={submission.id} className={`results-col-grade ${stripeClass}`}>
                            <button
                              type="button"
                              className="results-grade-btn"
                              title={guessText || '(no guess)'}
                              onClick={() => cycleMark(submission.id, track.id)}
                            >
                              <span className="results-grade-char">{gradeLabel}</span>
                            </button>
                            {guessText ? <div className="results-guess-preview">{guessText}</div> : null}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
