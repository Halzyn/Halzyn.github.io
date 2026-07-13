import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { pageTitle } from '../../lib/pageTitle'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import type { Game } from '../../lib/types'
import { compareGameTitles } from '../../lib/gamesIndex'
import { useGamesCatalog } from '../../hooks/useGamesQueries'

export function AdminGames() {
  useDocumentTitle(pageTitle('Admin', 'Games'))
  const { data: games = [], error, isLoading } = useGamesCatalog()
  const loadError = error instanceof Error ? error.message : null

  const sortedGames = useMemo(
    () => games.slice().sort((a, b) => compareGameTitles(a.primary_title, b.primary_title)),
    [games],
  )

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
        {isLoading ? (
          <p className="muted">Loading games...</p>
        ) : (
          <ul className="card-list">
            {sortedGames.map((game: Game) => (
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
