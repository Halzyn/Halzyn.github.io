import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ContestTrackAudio } from '../components/ContestTrackAudio'
import { pageTitle } from '../lib/pageTitle'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import type { Contest, Game, GameAlternateTitle, Track } from '../lib/types'
import { trackAppearanceDedupeKey, trackLineLabel } from '../lib/trackDisplay'
import type { GamePageContestGroup } from '../lib/queries/games'
import { useGamePage } from '../hooks/useGamesQueries'

function sortContests(a: Contest, b: Contest): number {
  return new Date(b.deadline).getTime() - new Date(a.deadline).getTime()
}

function AlternateTitlesLine({ titles }: { titles: GameAlternateTitle[] }) {
  if (titles.length === 0) return null

  return (
    <p className="muted game-page-alt-line">
      {titles.length === 1 ? (
        <>
          <span className="game-page-alt-label">Alternate title: </span>
          {titles[0]!.title}
        </>
      ) : (
        <>
          <span className="game-page-alt-label">Alternate titles: </span>
          {titles.map((alternate, index) => (
            <span key={alternate.id}>
              {index > 0 ? ', ' : null}
              {alternate.title}
            </span>
          ))}
        </>
      )}
    </p>
  )
}

function hasPublicGameDetails(game: Game): boolean {
  return Boolean(
    game.cover_image_url ||
      (game.genres && game.genres.length > 0) ||
      (game.platforms && game.platforms.length > 0) ||
      game.release_date ||
      game.description,
  )
}

function GameDetailsSection({ game }: { game: Game }) {
  if (!hasPublicGameDetails(game)) return null

  return (
    <section className="section game-page-details">
      <h2 className="game-page-section-title">Game details</h2>
      <div className="game-page-igdb-grid">
        {game.cover_image_url ? (
          <div className="game-page-cover">
            <img src={game.cover_image_url} alt="" loading="lazy" decoding="async" />
          </div>
        ) : null}
        <div className="game-page-igdb-facts">
          {game.release_date ? (
            <p className="game-page-igdb-line">
              <span className="game-page-igdb-label">Released</span>{' '}
              <time dateTime={game.release_date}>
                {new Date(`${game.release_date}T12:00:00`).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </time>
            </p>
          ) : null}
          {game.genres && game.genres.length > 0 ? (
            <p className="game-page-igdb-line">
              <span className="game-page-igdb-label">Genres</span> {game.genres.join(', ')}
            </p>
          ) : null}
          {game.platforms && game.platforms.length > 0 ? (
            <p className="game-page-igdb-line">
              <span className="game-page-igdb-label">Platforms</span> {game.platforms.join(', ')}
            </p>
          ) : null}
          {game.description ? <p className="game-page-igdb-desc">{game.description}</p> : null}
        </div>
      </div>
    </section>
  )
}

function useMergedTrackRows(game: Game | null, contestGroups: GamePageContestGroup[]) {
  const tracksFlatWithContest = useMemo(() => {
    const rows: { track: Track; contest: Contest }[] = []
    for (const group of contestGroups) {
      for (const track of group.tracks) rows.push({ track, contest: group.contest })
    }
    rows.sort((a, b) => {
      const byContest = sortContests(a.contest, b.contest)
      if (byContest !== 0) return byContest
      return a.track.sort_order - b.track.sort_order
    })
    return rows
  }, [contestGroups])

  return useMemo(() => {
    if (!game) return [] as { track: Track; contests: Contest[] }[]
    const byDedupeKey = new Map<
      string,
      { track: Track; contests: Contest[]; representativeContest: Contest }
    >()
    for (const { track, contest } of tracksFlatWithContest) {
      const dedupeKey = trackAppearanceDedupeKey(game.primary_title, track)
      const existing = byDedupeKey.get(dedupeKey)
      if (!existing) {
        byDedupeKey.set(dedupeKey, { track, contests: [contest], representativeContest: contest })
        continue
      }
      if (!existing.contests.some((c) => c.id === contest.id)) {
        existing.contests.push(contest)
      }
      if (sortContests(contest, existing.representativeContest) < 0) {
        existing.track = track
        existing.representativeContest = contest
      }
    }
    const rows = [...byDedupeKey.values()].map((entry) => ({
      track: entry.track,
      contests: entry.contests.slice().sort((a, b) => sortContests(a, b)),
    }))
    rows.sort((left, right) => {
      const leftLatest = Math.max(...left.contests.map((c) => new Date(c.deadline).getTime()))
      const rightLatest = Math.max(...right.contests.map((c) => new Date(c.deadline).getTime()))
      if (rightLatest !== leftLatest) return rightLatest - leftLatest
      return trackLineLabel(left.track).localeCompare(trackLineLabel(right.track), undefined, {
        sensitivity: 'base',
      })
    })
    return rows
  }, [game, tracksFlatWithContest])
}

export function GamePage() {
  const { slug } = useParams()
  const { data, error, isLoading } = useGamePage(slug)

  const game = data?.game ?? null
  const alternates = data?.alternates ?? []
  const contestGroups = data?.contestGroups ?? []
  const loadError = error instanceof Error ? error.message : null

  const documentTitle = useMemo(() => {
    if (!slug) return pageTitle('Game')
    if (isLoading) return pageTitle('Game')
    if (!game) return pageTitle('Game not found')
    return pageTitle(game.primary_title)
  }, [slug, isLoading, game])

  useDocumentTitle(documentTitle)

  const mergedTrackRows = useMergedTrackRows(game, contestGroups)
  const mergedTracks = useMemo(() => mergedTrackRows.map((row) => row.track), [mergedTrackRows])
  const listRowContests = useMemo(
    () => mergedTrackRows.map((row) => row.contests.map((c) => ({ title: c.title, slug: c.slug }))),
    [mergedTrackRows],
  )

  if (!slug) return null
  if (loadError && !game) return <p className="banner warn">{loadError}</p>
  if (isLoading || !game) return <p className="muted">Loading...</p>

  return (
    <div className="page">
      <p>
        <Link to="/games">← Games</Link>
      </p>
      <h1>{game.primary_title}</h1>
      <AlternateTitlesLine titles={alternates} />

      <GameDetailsSection game={game} />

      <section className="section game-page-tracks">
        <h2 className="game-page-section-title">Track list</h2>
        {mergedTracks.length > 0 ? (
          <ContestTrackAudio tracks={mergedTracks} listRowContests={listRowContests} />
        ) : (
          <p className="muted">No tracks found for this game.</p>
        )}
      </section>
    </div>
  )
}
