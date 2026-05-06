import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { signOutAndReloadHome } from '../lib/auth'
import { playersSlug } from '../lib/slugify'

export function AuthBar() {
  const { session, profile } = useAuth()
  const slug = playersSlug(profile?.username)
  const profileTo = slug ? `/players/${encodeURIComponent(slug)}` : '/profile/edit'

  if (!session?.user) {
    return (
      <Link className="button small ghost auth-bar-link" to="/auth">
        Sign in
      </Link>
    )
  }

  return (
    <span className="auth-bar-session">
      <Link to={profileTo}>Profile</Link>
      <button type="button" className="button small ghost" onClick={() => void signOutAndReloadHome()}>
        Sign out
      </button>
    </span>
  )
}
