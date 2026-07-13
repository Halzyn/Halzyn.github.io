import { useLayoutEffect, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { pageTitle } from '../lib/pageTitle'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import type { Game } from '../lib/types'
import {
  GAMES_INDEX_ORDER,
  compareGameTitles,
  gamesIndex,
  gamesSectionDomId,
  type GamesIndex,
} from '../lib/gamesIndex'
import { useGamesCatalog } from '../hooks/useGamesQueries'

export function GamesPage() {
  useDocumentTitle(pageTitle('Games'))
  const location = useLocation()
  const { data: games = [], error, isLoading: catalogLoading } = useGamesCatalog()
  const loadError = error instanceof Error ? error.message : null

  const gamesByIndex = useMemo(() => {
    const map = new Map<GamesIndex, Game[]>()
    for (const game of games) {
      const indexKey = gamesIndex(game.primary_title)
      const gamesInSection = map.get(indexKey) ?? []
      gamesInSection.push(game)
      map.set(indexKey, gamesInSection)
    }
    for (const list of map.values()) {
      list.sort((a, b) => compareGameTitles(a.primary_title, b.primary_title))
    }
    return map
  }, [games])

  const sectionKeysWithGames = useMemo(
    () => GAMES_INDEX_ORDER.filter((sectionKey) => (gamesByIndex.get(sectionKey)?.length ?? 0) > 0),
    [gamesByIndex],
  )

  useLayoutEffect(() => {
    if (catalogLoading || loadError) return
    const id = location.hash.replace(/^#/, '').trim()
    if (!id) return

    const scrollToHash = () => {
      const element = document.getElementById(id)
      if (element) element.scrollIntoView({ block: 'start' })
    }

    scrollToHash()
    const animationFrame = window.requestAnimationFrame(scrollToHash)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [location.pathname, location.hash, catalogLoading, loadError, sectionKeysWithGames])

  return (
    <div className="page games-page">
      <h1>Games</h1>
      <p className="lede muted">
        Full catalog of all games that have appeared in past contests. You can click on a game to view some metadata, as well as the tracks that were used.
      </p>
      {loadError ? <p className="banner warn">{loadError}</p> : null}

      {catalogLoading ? (
        <p className="muted">Loading games...</p>
      ) : games.length === 0 && !loadError ? (
        <p className="muted">Could not load games. Whoops!</p>
      ) : (
        <div className="games-page-layout">
          <div className="games-page-main">
            <div className="games-index">
              {sectionKeysWithGames.map((sectionKey) => {
                const gamesForSection = gamesByIndex.get(sectionKey)!
                return (
                  <section
                    key={sectionKey}
                    id={gamesSectionDomId(sectionKey)}
                    className="games-index-section section"
                  >
                    <h2 className="games-index-head">{sectionKey}</h2>
                    <ul className="games-index-columns">
                      {gamesForSection.map((game) => (
                        <li key={game.id}>
                          <Link to={`/games/${encodeURIComponent(game.slug)}`}>{game.primary_title}</Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )
              })}
            </div>
          </div>
          {sectionKeysWithGames.length > 0 ? (
            <aside className="games-page-dir" aria-label="Jump to section">
              <nav className="games-dir-nav">
                {sectionKeysWithGames.map((sectionKey) => (
                  <a key={sectionKey} className="games-dir-link" href={`#${gamesSectionDomId(sectionKey)}`}>
                    {sectionKey}
                  </a>
                ))}
              </nav>
            </aside>
          ) : null}
        </div>
      )}
    </div>
  )
}
