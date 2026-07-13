import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { pageTitle } from '../lib/pageTitle'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getSupabase } from '../lib/supabase'
import { avatarPublicUrl } from '../lib/avatar'
import { DisplayNameStyled } from '../components/DisplayNameStyled'
import { computePpRankByUserId, formatPlayerListPp } from '../lib/performancePoints'
import { usePlayersPublic } from '../hooks/usePlayersQueries'

type SortMode = 'name' | 'pp'

const SORT_CONTROLS: { mode: SortMode; label: string }[] = [
  { mode: 'pp', label: 'PP' },
  { mode: 'name', label: 'Display name' },
]

function toolbarButtonClass(active: boolean): string {
  return active ? 'button small primary' : 'button small ghost'
}

export function PlayersPage() {
  useDocumentTitle(pageTitle('Players'))
  const supabase = getSupabase()
  const { data, error, isLoading } = usePlayersPublic()
  const [sortMode, setSortMode] = useState<SortMode>('pp')

  const profiles = data?.profiles ?? []
  const displayNameStyleByUserId = data?.displayNameStyleByUserId ?? new Map()
  const loadError = error instanceof Error ? error.message : null

  const ppRankByUserId = useMemo(() => computePpRankByUserId(profiles), [profiles])

  const sortedProfiles = useMemo(() => {
    const copy = [...profiles]
    if (sortMode === 'name') {
      copy.sort((a, b) => a.display_name.localeCompare(b.display_name))
    } else {
      copy.sort((a, b) => (b.performance_points ?? 0) - (a.performance_points ?? 0))
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
      <h2>Players</h2>
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
                    <span className="player-card-rank">#{ppRankByUserId.get(profile.id) ?? '-'}.</span>
                    <span className="card-title">
                      <DisplayNameStyled text={profile.display_name} info={displayNameStyleByUserId.get(profile.id)} />
                    </span>
                  </span>
                  <span className="player-card-pp">{formatPlayerListPp(profile.performance_points)}</span>
                </Link>
              </li>
            )
          })}
        </ul>
        {isLoading && sortedProfiles.length === 0 && !loadError ? (
          <p className="muted">Loading profiles...</p>
        ) : null}
      </section>
    </div>
  )
}
