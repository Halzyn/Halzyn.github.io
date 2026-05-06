import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { pageTitle } from '../lib/pageTitle'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getSupabase } from '../lib/supabase'
import { avatarPublicUrl } from '../lib/avatar'
import type { PublicProfile } from '../lib/types'

type SortMode = 'id' | 'name'

const SORT_CONTROLS: { mode: SortMode; label: string }[] = [
  { mode: 'id', label: 'Player #' },
  { mode: 'name', label: 'Display name' },
]

function toolbarButtonClass(active: boolean): string {
  return active ? 'button small primary' : 'button small ghost'
}

export function PlayersPage() {
  useDocumentTitle(pageTitle('Players'))
  const supabase = getSupabase()
  const [profiles, setProfiles] = useState<PublicProfile[]>([])
  const [sortMode, setSortMode] = useState<SortMode>('id')
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    async function loadPlayers() {
      setLoadError(null)
      const { data, error } = await supabase.rpc('list_players_public')
      if (error) {
        setLoadError(error.message)
        return
      }
      setProfiles((data ?? []) as PublicProfile[])
    }
    void loadPlayers()
  }, [supabase])

  const sortedProfiles = useMemo(() => {
    const copy = [...profiles]
    if (sortMode === 'name') {
      copy.sort((a, b) => a.display_name.localeCompare(b.display_name))
    } else {
      copy.sort((a, b) => (a.player_number ?? 0) - (b.player_number ?? 0))
    }
    return copy
  }, [profiles, sortMode])

  return (
    <div className="page">
      <h1 className="visually-hidden">Players</h1>
      {loadError ? <p className="banner warn">{loadError}</p> : null}

      <div className="row tight site-toolbar" style={{ marginBottom: '1rem' }}>
        <span className="muted small">Sort:</span>
        {SORT_CONTROLS.map(({ mode, label }) => (
          <button
            key={mode}
            type="button"
            className={toolbarButtonClass(sortMode === mode)}
            onClick={() => setSortMode(mode)}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="section">
        <h2>Public profiles</h2>
        <ul className="card-list">
          {sortedProfiles.map((profile) => {
            const avatarSrc = avatarPublicUrl(supabase, profile.avatar_path)
            return (
              <li key={profile.id} className="card">
                <Link to={`/players/${encodeURIComponent(profile.username)}`} className="player-card-link">
                  {avatarSrc ? (
                    <img
                      key={profile.avatar_path ?? profile.id}
                      src={avatarSrc}
                      alt=""
                      className="player-card-avatar"
                      width={40}
                      height={40}
                      decoding="async"
                    />
                  ) : (
                    <span className="player-card-avatar player-card-avatar--placeholder" aria-hidden />
                  )}
                  <span className="player-card-text">
                    <span className="card-title">{profile.display_name}</span>
                    <span className="muted small">
                      #{profile.player_number} · @{profile.username}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
        {sortedProfiles.length === 0 && !loadError ? (
          <p className="muted">Loading profiles...</p>
        ) : null}
      </section>
    </div>
  )
}
