import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { pageTitle } from '../../lib/pageTitle'
import { contestIdFromModeratorAdminPath, normalizePathname } from '../../lib/adminPaths'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { getSupabase } from '../../lib/supabase'

export function AdminLogin() {
  useDocumentTitle(pageTitle('Admin sign in'))
  const supabase = getSupabase()
  const location = useLocation()
  const { ready, session, isAdmin } = useAuth()

  const rawReturnPath = (location.state as { from?: string } | undefined)?.from ?? '/admin/contests'
  const afterLoginPath = normalizePathname(rawReturnPath)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signInError, setSignInError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSignInError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setSignInError(error.message)
      return
    }
  }

  if (!ready) {
    return (
      <div className="admin-login-page">
        <p className="muted">Loading...</p>
      </div>
    )
  }

  if (session) {
    if (isAdmin) {
      return <Navigate to={afterLoginPath} replace />
    }
    if (contestIdFromModeratorAdminPath(afterLoginPath)) {
      return <Navigate to={afterLoginPath} replace />
    }
    return <Navigate to="/404" replace />
  }

  return (
    <div className="admin-login-page">
      <div className="panel admin-login-card">
        <h1 className="admin-login-title">Admin sign in</h1>
        <form className="form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {signInError ? <p className="banner warn">{signInError}</p> : null}
          <button type="submit" className="button primary admin-login-submit">
            Sign in
          </button>
        </form>
        <p className="admin-login-footer">
          <Link to="/">Back to site</Link>
        </p>
      </div>
    </div>
  )
}
