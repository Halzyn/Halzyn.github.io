import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Contest, GradingMark, Submission, SubmissionGuess, Track } from '../../lib/types'
import { scoreForSubmission, soloGameWinnerByTrack } from '../../lib/scoring'

type Mark = 'game' | 'franchise' | null

export function AdminGrading() {
  const { id } = useParams()
  const [contest, setContest] = useState<Contest | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [guesses, setGuesses] = useState<SubmissionGuess[]>([])
  const [marks, setMarks] = useState<GradingMark[]>([])
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !id) return
    setErr(null)
    const { data: c, error: cErr } = await supabase.from('contests').select('*').eq('id', id).single()
    if (cErr || !c) {
      setContest(null)
      setErr(cErr?.message ?? 'Not found')
      return
    }
    setContest(c as Contest)

    const { data: tRows } = await supabase
      .from('tracks')
      .select('*')
      .eq('contest_id', id)
      .order('sort_order', { ascending: true })
    const tList = (tRows ?? []) as Track[]
    setTracks(tList)

    const { data: sRows } = await supabase.from('submissions').select('*').eq('contest_id', id)
    const subs = (sRows ?? []) as Submission[]
    setSubmissions(subs)
    const sids = subs.map((s) => s.id)
    let gList: SubmissionGuess[] = []
    if (sids.length) {
      const { data: gRows } = await supabase.from('submission_guesses').select('*').in('submission_id', sids)
      gList = (gRows ?? []) as SubmissionGuess[]
    }
    setGuesses(gList)

    const tids = tList.map((t) => t.id)
    let mList: GradingMark[] = []
    if (tids.length) {
      const { data: mRows } = await supabase.from('grading_marks').select('*').in('track_id', tids)
      mList = (mRows ?? []) as GradingMark[]
    }
    setMarks(mList)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const markMap = useMemo(() => {
    const m = new Map<string, 'game' | 'franchise'>()
    for (const x of marks) {
      m.set(`${x.submission_id}:${x.track_id}`, x.mark)
    }
    return m
  }, [marks])

  function getMark(submissionId: string, trackId: string): Mark {
    return markMap.get(`${submissionId}:${trackId}`) ?? null
  }

  async function setMark(submissionId: string, trackId: string, next: Mark) {
    if (!supabase) return
    if (next === null) {
      await supabase.from('grading_marks').delete().match({ submission_id: submissionId, track_id: trackId })
    } else {
      await supabase.from('grading_marks').upsert(
        { submission_id: submissionId, track_id: trackId, mark: next },
        { onConflict: 'submission_id,track_id' },
      )
    }
    void load()
  }

  function cycle(submissionId: string, trackId: string) {
    const cur = getMark(submissionId, trackId)
    const order: Mark[] = [null, 'game', 'franchise']
    const idx = order.indexOf(cur)
    const next = order[(idx + 1) % order.length]!
    void setMark(submissionId, trackId, next)
  }

  const trackOrder = useMemo(() => tracks.map((t) => t.id), [tracks])

  const preview = useMemo(() => {
    const solo = soloGameWinnerByTrack(marks)
    return submissions.map((s) => ({
      id: s.id,
      name: s.contestant_name,
      score: scoreForSubmission(s.id, trackOrder, marks),
      solo: [...solo.entries()].filter(([, sub]) => sub === s.id).length,
    }))
  }, [submissions, marks, trackOrder])

  if (!id) return null
  if (err && !contest) return <p className="banner warn">{err}</p>
  if (!contest) return <p className="muted">Loading…</p>

  const guessText = (sid: string, tid: string) =>
    guesses.find((g) => g.submission_id === sid && g.track_id === tid)?.guess_text ?? ''

  return (
    <div className="page wide">
      <p>
        <Link to={`/admin/contests/${contest.id}`}>← Contest</Link>
      </p>
      <h1>Grading — {contest.title}</h1>
      <p className="muted small">
        Click a cell to cycle: empty → <strong>X</strong> (correct game) → <strong>~</strong> (franchise
        only) → empty. Franchise guesses do not count toward the solo bonus (computed only from X
        marks).
      </p>
      {err ? <p className="banner warn">{err}</p> : null}

      <section className="section">
        <h2>Score preview</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Score</th>
                <th>Solo bonuses</th>
              </tr>
            </thead>
            <tbody>
              {[...preview].sort((a, b) => b.score - a.score).map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.score.toFixed(1)}</td>
                  <td>{r.solo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>Grid</h2>
        {submissions.length === 0 ? <p className="muted">No submissions yet.</p> : null}
        <div className="table-wrap scroll">
          <table className="table dense">
            <thead>
              <tr>
                <th>Contestant</th>
                {tracks.map((t) => (
                  <th key={t.id}>
                    T{t.sort_order + 1}
                    {t.difficulty ? (
                      <>
                        <br />
                        <span className="muted tiny">{t.difficulty}</span>
                      </>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id}>
                  <td className="sticky-name">
                    <div className="strong">{s.contestant_name}</div>
                    <div className="muted tiny">{new Date(s.created_at).toLocaleString()}</div>
                  </td>
                  {tracks.map((t) => {
                    const m = getMark(s.id, t.id)
                    const label = m === 'game' ? 'X' : m === 'franchise' ? '~' : '·'
                    const g = guessText(s.id, t.id)
                    return (
                      <td key={t.id} className="grade-cell">
                        <button
                          type="button"
                          className={`grade-btn mark-${m ?? 'none'}`}
                          title={g || '(no guess)'}
                          onClick={() => cycle(s.id, t.id)}
                        >
                          {label}
                        </button>
                        {g ? <div className="guess-preview muted tiny">{g}</div> : null}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
