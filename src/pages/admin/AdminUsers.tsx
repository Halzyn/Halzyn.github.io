import { Link } from 'react-router-dom'
import { pageTitle } from '../../lib/pageTitle'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import type { Profile } from '../../lib/types'
import { useAdminUsersList } from '../../hooks/useAdminQueries'

export function AdminUsers() {
  useDocumentTitle(pageTitle('Admin', 'Users'))
  const { data: profiles = [], error } = useAdminUsersList()
  const loadError = error instanceof Error ? error.message : null

  return (
    <div className="page">
      <p className="muted small">
        <Link to="/admin/contests">← Contests</Link>
      </p>
      <h1>Users</h1>
      {loadError ? <p className="banner warn">{loadError}</p> : null}
      <section className="section">
        <h2>Directory</h2>
        <ul className="card-list">
          {profiles.map((profile: Profile) => (
            <li key={profile.id} className="card">
              <Link to={`/admin/users/${profile.id}`}>
                <span className="card-title">
                  {profile.display_name ?? profile.username ?? profile.id.slice(0, 8)}
                </span>
                <span className="muted small">
                  #{profile.player_number ?? '-'} {profile.username ?? 'no username'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
