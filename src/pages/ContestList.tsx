import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, supabaseConfigured } from '../lib/supabase'
import type { Contest } from '../lib/types'
import { contestClosed } from '../lib/deadline'

export function ContestList() {
  const [rows, setRows] = useState<Contest[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setErr('Supabase is not configured.')
      return
    }
    void (async () => {
      const { data, error } = await supabase.from('contests').select('*').order('deadline', {
        ascending: false,
      })
      if (error) {
        setErr(error.message)
        return
      }
      setRows((data ?? []) as Contest[])
    })()
  }, [])

  if (!supabaseConfigured) {
    return <p className="banner warn">Supabase is not configured.</p>
  }
  if (err) return <p className="banner warn">{err}</p>

  return (
    <div className="page">
      <h1>All contests</h1>
      <ul className="card-list">
        {rows.map((c) => (
          <li key={c.id} className="card">
            <Link to={`/contests/${c.slug}`}>
              <span className="card-title">{c.title}</span>
              <span className="pill">{contestClosed(c.deadline) ? 'Closed' : 'Open'}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
