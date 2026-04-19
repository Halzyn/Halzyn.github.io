import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, supabaseConfigured } from '../lib/supabase'
import type { Contest, Track } from '../lib/types'
import { contestClosed } from '../lib/deadline'

export function SubmitPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [contest, setContest] = useState<Contest | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [name, setName] = useState('')
  const [guesses, setGuesses] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!slug || !supabase) return
    void (async () => {
      const { data: cRow, error: cErr } = await supabase
        .from('contests')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()
      if (cErr || !cRow) {
        setContest(null)
        return
      }
      const c = cRow as Contest
      setContest(c)
      if (contestClosed(c.deadline)) {
        setMsg('This contest is closed.')
      }
      const { data: tRows } = await supabase
        .from('tracks')
        .select('*')
        .eq('contest_id', c.id)
        .order('sort_order', { ascending: true })
      const list = (tRows ?? []) as Track[]
      setTracks(list)
      const g: Record<string, string> = {}
      for (const t of list) g[t.id] = ''
      setGuesses(g)
    })()
  }, [slug])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !contest) return
    if (contestClosed(contest.deadline)) {
      setMsg('Submissions are closed.')
      return
    }
    setBusy(true)
    setMsg(null)
    const payload = tracks.map((t) => ({
      track_id: t.id,
      text: guesses[t.id] ?? '',
    }))
    const { data, error } = await supabase.rpc('submit_contest_entry', {
      p_contest_id: contest.id,
      p_contestant_name: name.trim(),
      p_guesses: payload,
    })
    setBusy(false)
    if (error) {
      setMsg(error.message)
      return
    }
    void data
    navigate(`/contests/${contest.slug}`, { replace: true })
  }

  if (!supabaseConfigured) {
    return <p className="banner warn">Supabase is not configured.</p>
  }
  if (!slug) return null
  if (!contest) {
    return (
      <div className="page">
        <p>Contest not found.</p>
        <Link to="/">Home</Link>
      </div>
    )
  }

  const closed = contestClosed(contest.deadline)

  return (
    <div className="page narrow">
      <h1>Submit — {contest.title}</h1>
      {closed ? (
        <p className="banner warn">This contest is closed.</p>
      ) : (
        <>
          <p className="muted">
            One entry per person per contest. Use the track order shown on the contest page. You can
            leave tracks blank if you are not sure.
          </p>
          <form className="form" onSubmit={onSubmit}>
            <label className="field">
              <span>Your name (public on rankings after the deadline)</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                required
                autoComplete="nickname"
              />
            </label>
            {tracks.map((t) => (
              <label key={t.id} className="field">
                <span>
                  Track {t.sort_order + 1}
                  {t.difficulty ? ` · ${t.difficulty}` : ''}
                </span>
                <input
                  value={guesses[t.id] ?? ''}
                  onChange={(e) => setGuesses((g) => ({ ...g, [t.id]: e.target.value }))}
                  maxLength={500}
                  placeholder="Game title / notes"
                />
              </label>
            ))}
            {msg ? <p className="banner warn">{msg}</p> : null}
            <div className="actions">
              <button type="submit" className="button primary" disabled={busy}>
                {busy ? 'Sending…' : 'Send entry'}
              </button>
              <Link to={`/contests/${contest.slug}`} className="button ghost">
                Cancel
              </Link>
            </div>
          </form>
        </>
      )}
    </div>
  )
}
