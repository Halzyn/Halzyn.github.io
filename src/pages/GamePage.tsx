import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ContestTrackAudio } from '../components/ContestTrackAudio'
import { pageTitle } from '../lib/pageTitle'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getSupabase } from '../lib/supabase'
import type { Contest, Game, GameAlternateTitle, Track } from '../lib/types'
import { firstOf } from '../lib/utils'
import { trackAppearanceDedupeKey, trackLineLabel } from '../lib/trackDisplay'

type ContestGroup = {
  contest: Contest
  tracks: Track[]
}

type TrackGameJoinRow = {
  tracks: EmbeddedTrack | EmbeddedTrack[] | null
}

type EmbeddedTrack = {
  id: string
  contest_id: string
  sort_order: number
  difficulty: string | null
  audio_path: string
  track_answers:
    | { song_title: string | null }
    | { song_title: string | null }[]
    | null
  contests: Contest | Contest[] | null
}

function sortContests(a: Contest, b: Contest): number {
  return new Date(b.deadline).getTime() - new Date(a.deadline).getTime()
}

function buildContestGroups(trackGameRows: unknown[] | null): ContestGroup[] {
  const byContestId = new Map<string, { contest: Contest; tracks: Track[] }>()

  for (const raw of trackGameRows ?? []) {
    const row = raw as TrackGameJoinRow
    const embeddedTrack = firstOf(row.tracks)
    if (!embeddedTrack) continue

    const contest = firstOf(embeddedTrack.contests)
    if (!contest) continue

    const answerRow = firstOf(embeddedTrack.track_answers)
    const songTitle = answerRow?.song_title ?? null

    const track: Track = {
      id: embeddedTrack.id,
      contest_id: embeddedTrack.contest_id,
      sort_order: embeddedTrack.sort_order,
      difficulty: embeddedTrack.difficulty,
      audio_path: embeddedTrack.audio_path,
      song_title: songTitle,
    }

    let group = byContestId.get(contest.id)
    if (!group) {
      group = { contest, tracks: [] }
      byContestId.set(contest.id, group)
    }
    if (!group.tracks.some((existing) => existing.id === track.id)) {
      group.tracks.push(track)
    }
  }

  const groups: ContestGroup[] = [...byContestId.values()].map((entry) => ({
    contest: entry.contest,
    tracks: entry.tracks.slice().sort((a, b) => a.sort_order - b.sort_order),
  }))
  groups.sort((a, b) => sortContests(a.contest, b.contest))
  return groups
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

export function GamePage() {
  const supabase = getSupabase()
  const { slug } = useParams()

  const [game, setGame] = useState<Game | null>(null)
  const [alternates, setAlternates] = useState<GameAlternateTitle[]>([])
  const [contestGroups, setContestGroups] = useState<ContestGroup[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [documentTitle, setDocumentTitle] = useState(() => pageTitle('Game'))

  useDocumentTitle(documentTitle)

  useEffect(() => {
    if (!slug) {
      setDocumentTitle(pageTitle('Game'))
      return
    }

    async function loadGamePage() {
      setLoadError(null)
      setGame(null)
      setAlternates([])
      setContestGroups([])

      const { data: gameRow, error: gameError } = await supabase
        .from('games')
        .select(
          'id, primary_title, slug, created_at, updated_at, igdb_id, cover_image_url, genres, platforms, release_date, description',
        )
        .eq('slug', slug)
        .maybeSingle()

      if (gameError || !gameRow) {
        setGame(null)
        setLoadError(gameError?.message ?? 'Game not found.')
        setDocumentTitle(pageTitle('Game not found'))
        return
      }

      const gameData = gameRow as Game
      setGame(gameData)
      setDocumentTitle(pageTitle(gameData.primary_title))

      const { data: alternateRows } = await supabase
        .from('game_alternate_titles')
        .select('id, game_id, title, created_at')
        .eq('game_id', gameData.id)
        .order('title', { ascending: true })
      setAlternates((alternateRows ?? []) as GameAlternateTitle[])

      const { data: trackGameRows, error: trackGameError } = await supabase
        .from('track_game')
        .select(
          `
          tracks (
            id,
            contest_id,
            sort_order,
            difficulty,
            audio_path,
            track_answers ( song_title ),
            contests ( id, slug, title, deadline, published, description, created_at )
          )
        `,
        )
        .eq('game_id', gameData.id)

      if (trackGameError) {
        setLoadError(trackGameError.message)
        setContestGroups([])
        return
      }

      setContestGroups(buildContestGroups(trackGameRows))
    }

    void loadGamePage()
  }, [slug, supabase])

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

  const mergedTrackRows = useMemo(() => {
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

  const mergedTracks = useMemo(() => mergedTrackRows.map((row) => row.track), [mergedTrackRows])
  const listRowContests = useMemo(
    () => mergedTrackRows.map((row) => row.contests.map((c) => ({ title: c.title, slug: c.slug }))),
    [mergedTrackRows],
  )

  if (!slug) return null
  if (loadError && !game) return <p className="banner warn">{loadError}</p>
  if (!game) return <p className="muted">Loading...</p>

  return (
    <div className="page">
      <p>
        <Link to="/games">← Games</Link>
      </p>
      <h1>{game.primary_title}</h1>
      <AlternateTitlesLine titles={alternates} />
      {loadError ? <p className="banner warn">{loadError}</p> : null}

      <GameDetailsSection game={game} />

      <section className="section game-page-tracks">
        <h2 className="game-page-section-title">Track list</h2>
        {mergedTracks.length > 0 ? (
          <ContestTrackAudio tracks={mergedTracks} listRowContests={listRowContests} />
        ) : (
          <p className="muted">Loading tracks...</p>
        )}
      </section>
    </div>
  )
}
