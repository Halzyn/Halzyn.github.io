import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { pageTitle } from '../../lib/pageTitle'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { getSupabase } from '../../lib/supabase'
import type { Profile } from '../../lib/types'

export function AdminUsers() {
  useDocumentTitle(pageTitle('Admin', 'Users'))
  const supabase = getSupabase()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProfiles() {
      setLoadError(null)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('player_number', { ascending: true, nullsFirst: false })
      if (error) {
        setLoadError(error.message)
        return
      }
      setProfiles((data ?? []) as Profile[])
    }
    void loadProfiles()
  }, [supabase])

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
          {profiles.map((profile) => (
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
