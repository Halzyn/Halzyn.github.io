import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, supabaseConfigured } from '../lib/supabase'
import type { Contest } from '../lib/types'
import { contestClosed } from '../lib/deadline'

export function Home() {
  const [contests, setContests] = useState<Contest[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setErr('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
      return
    }
    void (async () => {
      const { data, error } = await supabase
        .from('contests')
        .select('*')
        .order('deadline', { ascending: false })
      if (error) {
        setErr(error.message)
        return
      }
      setContests((data ?? []) as Contest[])
    })()
  }, [])

  const open = contests.filter((c) => !contestClosed(c.deadline))
  const past = contests.filter((c) => contestClosed(c.deadline))

  return (
    <div className="page">
      <section className="hero">
        <h1>Video game music contests</h1>
        <p className="lede">
          Name the game from short, metadata-free clips. Past contests stay archived with spoilered
          answers and rankings; active contests show a live countdown to the deadline.
        </p>
        {!supabaseConfigured ? (
          <p className="banner warn">{err}</p>
        ) : err ? (
          <p className="banner warn">{err}</p>
        ) : null}
      </section>

      <section className="section">
        <h2>Current contests</h2>
        {open.length === 0 ? (
          <p className="muted">No open contests right now. Check back soon.</p>
        ) : (
          <ul className="card-list">
            {open.map((c) => (
              <li key={c.id} className="card">
                <Link to={`/contests/${c.slug}`}>
                  <span className="card-title">{c.title}</span>
                  <span className="muted small">Deadline {new Date(c.deadline).toLocaleString()}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <h2>Past contests</h2>
        {past.length === 0 ? (
          <p className="muted">No archived contests yet.</p>
        ) : (
          <ul className="card-list">
            {past.map((c) => (
              <li key={c.id} className="card">
                <Link to={`/contests/${c.slug}`}>
                  <span className="card-title">{c.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="muted small">
        <Link to="/contests">Browse all contests</Link>
        {' · '}
        <Link to="/admin">Admin</Link>
      </p>
    </div>
  )
}
