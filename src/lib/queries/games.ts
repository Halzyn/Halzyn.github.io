import { compareGameTitles } from '../gamesIndex'
import { getSupabase } from '../supabase'
import { firstOf } from '../utils'
import type { Contest, Game, GameAlternateTitle, Track } from '../types'

export async function fetchGamesCatalog(): Promise<Game[]> {
  const { data, error } = await getSupabase()
    .from('games')
    .select('id, primary_title, slug, created_at, updated_at')
  if (error) throw error
  return (data ?? []) as Game[]
}

export async function fetchGamesCatalogSorted(): Promise<Game[]> {
  const games = await fetchGamesCatalog()
  return games.slice().sort((a, b) => compareGameTitles(a.primary_title, b.primary_title))
}

export type GamePageContestGroup = {
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
  track_answers: { song_title: string | null } | { song_title: string | null }[] | null
  contests: Contest | Contest[] | null
}

function sortContests(a: Contest, b: Contest): number {
  return new Date(b.deadline).getTime() - new Date(a.deadline).getTime()
}

function buildContestGroups(trackGameRows: unknown[] | null): GamePageContestGroup[] {
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

  const groups: GamePageContestGroup[] = [...byContestId.values()].map((entry) => ({
    contest: entry.contest,
    tracks: entry.tracks.slice().sort((a, b) => a.sort_order - b.sort_order),
  }))
  groups.sort((a, b) => sortContests(a.contest, b.contest))
  return groups
}

export type GamePageBundle = {
  game: Game | null
  alternates: GameAlternateTitle[]
  contestGroups: GamePageContestGroup[]
}

export async function fetchGamePageBundle(slug: string): Promise<GamePageBundle> {
  const supabase = getSupabase()

  const { data: gameRow, error: gameError } = await supabase
    .from('games')
    .select(
      'id, primary_title, slug, created_at, updated_at, igdb_id, cover_image_url, genres, platforms, release_date, description',
    )
    .eq('slug', slug)
    .maybeSingle()

  if (gameError) throw gameError
  if (!gameRow) {
    return { game: null, alternates: [], contestGroups: [] }
  }

  const game = gameRow as Game

  const [{ data: alternateRows }, { data: trackGameRows, error: trackGameError }] = await Promise.all([
    supabase
      .from('game_alternate_titles')
      .select('id, game_id, title, created_at')
      .eq('game_id', game.id)
      .order('title', { ascending: true }),
    supabase
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
      .eq('game_id', game.id),
  ])

  if (trackGameError) throw trackGameError

  return {
    game,
    alternates: (alternateRows ?? []) as GameAlternateTitle[],
    contestGroups: buildContestGroups(trackGameRows),
  }
}
