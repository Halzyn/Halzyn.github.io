import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSupabase } from '../../lib/supabase'
import type { Game } from '../../lib/types'
import { compareGameTitles } from '../../lib/gamesIndex'
import { pageTitle } from '../../lib/pageTitle'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

export function AdminGames() {
  useDocumentTitle(pageTitle('Admin', 'Games'))
  const supabase = getSupabase()
  const [games, setGames] = useState<Game[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    async function loadGames() {
      setLoadError(null)
      const { data, error } = await supabase
        .from('games')
        .select('id, primary_title, slug, created_at, updated_at')
      if (error) {
        setLoadError(error.message)
        return
      }
      const rows = (data ?? []) as Game[]
      setGames([...rows].sort((a, b) => compareGameTitles(a.primary_title, b.primary_title)))
    }
    void loadGames()
  }, [supabase])

  return (
    <div className="page">
      <p className="muted small">
        <Link to="/admin/contests">← Contests</Link>
      </p>
      <h1>Games catalog</h1>
      {loadError ? <p className="banner warn">{loadError}</p> : null}
      <section className="section">
        <h2>Catalog</h2>
        <p>
          <Link className="button primary" to="/admin/games/new">
            New game
          </Link>
        </p>
        {games.length === 0 ? (
          <p className="muted">Loading games...</p>
        ) : (
          <ul className="card-list">
            {games.map((game) => (
              <li key={game.id} className="card">
                <Link to={`/admin/games/${game.id}`}>
                  <span className="card-title">{game.primary_title}</span>
                  <span className="muted small">{game.slug}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
