import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { pageTitle } from '../lib/pageTitle'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getSupabase } from '../lib/supabase'

const MIN_PASSWORD_LENGTH = 8

function validationMessageForNewPassword(password: string, passwordConfirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return 'Password must be at least 8 characters.'
  if (password !== passwordConfirm) return 'Passwords do not match.'
  return null
}

function PasswordField({
  label,
  value,
  onValueChange,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="password"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        autoComplete="new-password"
        required
      />
    </label>
  )
}

export function ResetPasswordPage() {
  useDocumentTitle(pageTitle('New password'))
  const supabase = getSupabase()
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [pageError, setPageError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [passwordUpdated, setPasswordUpdated] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setPageError(null)
    const message = validationMessageForNewPassword(password, passwordConfirm)
    if (message) {
      setPageError(message)
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setPageError(error.message)
        return
      }
      setPasswordUpdated(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (passwordUpdated) {
    return (
      <div className="page">
        <p className="banner success" role="status">
          Password updated.
        </p>
        <p>
          <Link to="/">Home</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>Set a new password</h1>
      <form className="form" onSubmit={handleSubmit}>
        <PasswordField label="New password" value={password} onValueChange={setPassword} />
        <PasswordField label="Confirm" value={passwordConfirm} onValueChange={setPasswordConfirm} />
        {pageError ? <p className="banner warn">{pageError}</p> : null}
        <button type="submit" className="button primary" disabled={submitting}>
          {submitting ? '...' : 'Save'}
        </button>
      </form>
      <p className="muted small">
        <Link to="/auth">← Sign in</Link>
      </p>
    </div>
  )
}
