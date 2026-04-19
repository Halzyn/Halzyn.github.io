import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { supabase, supabaseConfigured } from '../../lib/supabase'

export function AdminLogin() {
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from ?? '/admin/contests'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [already, setAlready] = useState(false)

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setAlready(true)
    })
  }, [])

  if (!supabaseConfigured) {
    return <p className="banner warn">Supabase is not configured.</p>
  }

  if (already || ok) {
    return <Navigate to={from} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setErr(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setErr(error.message)
      return
    }
    setOk(true)
  }

  return (
    <div className="page narrow">
      <h1>Admin sign in</h1>
      <p className="muted small">
        Use the Supabase Auth user you marked as admin (<code>profiles.is_admin</code>).
      </p>
      <form className="form" onSubmit={onSubmit}>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {err ? <p className="banner warn">{err}</p> : null}
        <button type="submit" className="button primary">
          Sign in
        </button>
      </form>
      <p>
        <Link to="/">Back to site</Link>
      </p>
    </div>
  )
}
