import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, supabaseConfigured } from '../lib/supabase'
import type { Contest, GradingMark, Submission, Track, TrackAnswer } from '../lib/types'
import { contestClosed } from '../lib/deadline'
import { Countdown } from '../components/Countdown'
import { TrackPlayer } from '../components/TrackPlayer'
import { SpoilerAnswers } from '../components/SpoilerAnswers'
import { scoreForSubmission, soloGameWinnerByTrack } from '../lib/scoring'

export function ContestPage() {
  const { slug } = useParams()
  const [contest, setContest] = useState<Contest | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [answers, setAnswers] = useState<TrackAnswer[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [marks, setMarks] = useState<GradingMark[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!slug || !supabase) return
    void (async () => {
      setErr(null)
      const { data: cRow, error: cErr } = await supabase
        .from('contests')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()
      if (cErr) {
        setErr(cErr.message)
        return
      }
      if (!cRow) {
        setContest(null)
        return
      }
      const c = cRow as Contest
      setContest(c)

      const { data: tRows, error: tErr } = await supabase
        .from('tracks')
        .select('*')
        .eq('contest_id', c.id)
        .order('sort_order', { ascending: true })
      if (tErr) {
        setErr(tErr.message)
        return
      }
      setTracks((tRows ?? []) as Track[])

      const closed = contestClosed(c.deadline)
      const trackIds = (tRows ?? []).map((t: Track) => t.id)
      if (closed) {
        let aRows: TrackAnswer[] = []
        if (trackIds.length) {
          const { data } = await supabase.from('track_answers').select('*').in('track_id', trackIds)
          aRows = (data ?? []) as TrackAnswer[]
        }
        setAnswers(aRows)

        const { data: sRows } = await supabase.from('submissions').select('*').eq('contest_id', c.id)
        setSubmissions((sRows ?? []) as Submission[])

        const sid = new Set((sRows ?? []).map((s: Submission) => s.id))
        let filtered: GradingMark[] = []
        if (trackIds.length) {
          const { data: mRows } = await supabase
            .from('grading_marks')
            .select('*')
            .in('track_id', trackIds)
          filtered = ((mRows ?? []) as GradingMark[]).filter((m) => sid.has(m.submission_id))
        }
        setMarks(filtered)
      } else {
        setAnswers([])
        setSubmissions([])
        setMarks([])
      }
    })()
  }, [slug])

  const closed = contest ? contestClosed(contest.deadline) : false

  const trackOrder = useMemo(() => tracks.map((t) => t.id), [tracks])

  const leaderboard = useMemo(() => {
    if (!closed || submissions.length === 0) return []
    const solo = soloGameWinnerByTrack(marks)
    const rows = submissions.map((s) => ({
      id: s.id,
      name: s.contestant_name,
      score: scoreForSubmission(s.id, trackOrder, marks),
      solo: [...solo.entries()].filter(([, sub]) => sub === s.id).length,
    }))
    rows.sort((a, b) => b.score - a.score)
    return rows
  }, [closed, submissions, marks, trackOrder])

  if (!supabaseConfigured) {
    return <p className="banner warn">Supabase is not configured.</p>
  }
  if (!slug) return null
  if (err) return <p className="banner warn">{err}</p>
  if (contest === null && !err) {
    return (
      <div className="page">
        <p>Contest not found.</p>
        <Link to="/">Home</Link>
      </div>
    )
  }
  if (!contest) return null

  return (
    <div className="page">
      <header className="page-head">
        <h1>{contest.title}</h1>
        {contest.description ? <p className="lede">{contest.description}</p> : null}
        <p className="muted small">
          Deadline: {new Date(contest.deadline).toLocaleString()}
          {closed ? ' (closed)' : null}
        </p>
        {!closed ? <Countdown deadlineIso={contest.deadline} /> : null}
        {!closed ? (
          <p>
            <Link className="button" to={`/contests/${contest.slug}/submit`}>
              Submit answers
            </Link>
          </p>
        ) : null}
      </header>

      <section className="section">
        <h2>Tracks</h2>
        <div className="track-grid">
          {tracks.map((t) => (
            <TrackPlayer
              key={t.id}
              label={`Track ${t.sort_order + 1}`}
              audioPath={t.audio_path}
              difficulty={t.difficulty}
            />
          ))}
        </div>
        {tracks.length === 0 ? <p className="muted">No tracks published yet.</p> : null}
      </section>

      {closed ? (
        <>
          <SpoilerAnswers tracks={tracks} answers={answers} />
          <section className="section">
            <h2>Rankings</h2>
            {leaderboard.length === 0 ? (
              <p className="muted">
                Rankings appear here once submissions exist and marks are entered in admin. Scoring:
                1 point for a correct game (X), 0.5 for franchise only (~), plus 0.5 when you are
                the only person with a correct game on that track.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Score</th>
                      <th>Solo bonuses</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((r, i) => (
                      <tr key={r.id}>
                        <td>{i + 1}</td>
                        <td>{r.name}</td>
                        <td>{r.score.toFixed(1)}</td>
                        <td>{r.solo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
