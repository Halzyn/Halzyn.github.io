import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { pageTitle } from '../lib/pageTitle'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getSupabase } from '../lib/supabase'
import { authRedirectUrl } from '../lib/auth'
import { useToast } from '../toast/ToastContext'

type Mode = 'signIn' | 'signUp' | 'forgot'

const MODE_HEADER: Record<Mode, string> = {
  signIn: 'Sign in',
  signUp: 'Create account',
  forgot: 'Reset password',
}

const MODE_TABS: { mode: Mode; label: string }[] = [
  { mode: 'signIn', label: 'Sign in' },
  { mode: 'signUp', label: 'Sign up' },
  { mode: 'forgot', label: 'Forgot password' },
]

const USERNAME_REGEX = /^[a-zA-Z0-9_]{2,32}$/

export function AuthPage() {
  useDocumentTitle(pageTitle('Sign in'))
  const supabase = getSupabase()

  const [mode, setMode] = useState<Mode>('signIn')
  const [identifier, setIdentifier] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const { toast } = useToast()
  const [pageError, setPageError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [shouldRedirectHome, setShouldRedirectHome] = useState(false)

  const clearFeedback = useCallback(() => {
    setPageError(null)
  }, [])

  const selectMode = useCallback(
    (next: Mode) => {
      setMode(next)
      clearFeedback()
    },
    [clearFeedback],
  )

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setShouldRedirectHome(true)
    })
  }, [supabase])

  if (shouldRedirectHome) {
    return <Navigate to="/" replace />
  }

  async function handleSignIn(event: FormEvent) {
    event.preventDefault()
    clearFeedback()
    setSubmitting(true)
    try {
      const { data: resolvedEmail, error: resolveError } = await supabase.rpc('login_identifier_to_email', {
        p_identifier: identifier.trim(),
      })
      if (resolveError || !resolvedEmail) {
        setPageError('Unknown username or email, or sign up is not complete.')
        return
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: resolvedEmail as string,
        password,
      })
      if (error) {
        setPageError(error.message)
        return
      }
      setShouldRedirectHome(true)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSignUp(event: FormEvent) {
    event.preventDefault()
    clearFeedback()
    const trimmedUsername = username.trim()
    if (!USERNAME_REGEX.test(trimmedUsername)) {
      setPageError('Username: 2-32 characters, letters, digits, or underscore only.')
      return
    }
    if (password.length < 8) {
      setPageError('Password must be at least 8 characters.')
      return
    }
    if (password !== passwordConfirm) {
      setPageError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      const { data: usernameAvailable, error: availabilityError } = await supabase.rpc('username_is_available', {
        p_username: trimmedUsername,
      })
      if (availabilityError || usernameAvailable !== true) {
        setPageError(availabilityError?.message ?? 'That username is already taken.')
        return
      }
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: authRedirectUrl('auth/callback'),
          data: {
            username: trimmedUsername,
            display_name: trimmedUsername,
          },
        },
      })
      if (error) {
        setPageError(error.message)
        return
      }
      toast(
        'Check your email for a confirmation link from Supabase. After confirming, you can sign in with your username or email.',
      )
      setMode('signIn')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleForgotPassword(event: FormEvent) {
    event.preventDefault()
    clearFeedback()
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: authRedirectUrl('auth/reset-password'),
      })
      if (error) {
        setPageError(error.message)
        return
      }
      toast('If an account exists for that email, a reset link has been sent.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page auth-page">
      <h1>{MODE_HEADER[mode]}</h1>

      <div className="auth-mode-tabs">
        {MODE_TABS.map(({ mode: tabMode, label }) => (
          <button
            key={tabMode}
            type="button"
            className={mode === tabMode ? 'button small primary' : 'button small ghost'}
            onClick={() => selectMode(tabMode)}
          >
            {label}
          </button>
        ))}
      </div>

      {pageError ? <p className="banner warn">{pageError}</p> : null}

      {mode === 'signIn' ? (
        <form className="form auth-form" onSubmit={handleSignIn}>
          <label className="field">
            <span>Username or email</span>
            <input
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
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
          <button type="submit" className="button primary" disabled={submitting}>
            {submitting ? '...' : 'Sign in'}
          </button>
        </form>
      ) : null}

      {mode === 'signUp' ? (
        <form className="form auth-form" onSubmit={handleSignUp}>
          <label className="field">
            <span>Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <label className="field">
            <span>Confirm password</span>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <button type="submit" className="button primary" disabled={submitting}>
            {submitting ? '...' : 'Sign up'}
          </button>
        </form>
      ) : null}

      {mode === 'forgot' ? (
        <form className="form auth-form" onSubmit={handleForgotPassword}>
          <label className="field">
            <span>Email you signed up with</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <button type="submit" className="button primary" disabled={submitting}>
            {submitting ? '...' : 'Send reset link'}
          </button>
        </form>
      ) : null}

      <p className="muted small">
        <Link to="/">← Home</Link>
      </p>
    </div>
  )
}
