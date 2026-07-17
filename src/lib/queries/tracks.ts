import type { GameTooltip } from '../gameTooltip'
import {
  CONTEST_HOST_EMBED_SELECT,
  hostsMapFromContests,
  resolveChosenHostEntry,
} from '../contestHosts'
import type { DisplayNameStyleInfo } from '../displayNameStyle'
import { getSupabase } from '../supabase'
import { trackAppearanceDedupeKey } from '../trackDisplay'
import type { Contest, ContestWithHosts, Track, TrackAnswer } from '../types'

export type TracksPageContest = Pick<Contest, 'id' | 'slug' | 'title' | 'deadline'> & {
  chosenByHostKey: string | null
  chosenByDisplayName: string | null
  chosenByProfileUsername: string | null
  chosenByStyleInfo: DisplayNameStyleInfo | null
}

export type TracksPageRow = {
  track: Track
  contests: TracksPageContest[]
  answer: TrackAnswer | null
  gameTooltip?: GameTooltip
  correctGuesses: number
  franchiseGuesses: number
  primaryGameTitle: string
}

type TracksPageAppearance = {
  track: Track
  contest: TracksPageContest
  answer: TrackAnswer | null
  gameTooltip?: GameTooltip
  correctGuesses: number
  franchiseGuesses: number
}

type ListTracksPageRow = {
  track_id: string
  contest_id: string
  sort_order: number
  difficulty: string | null
  audio_path: string
  chosen_by_host_key: string | null
  chosen_by_display_name: string | null
  contest_slug: string
  contest_title: string
  contest_deadline: string
  song_title: string | null
  notes: string | null
  game_names: string[] | null
  primary_game_slug: string | null
  alternate_titles: string[] | null
  shared_music_titles: string[] | null
  correct_guesses: number
  franchise_guesses: number
}

function jsonStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function sortContests(a: TracksPageContest, b: TracksPageContest): number {
  return new Date(b.deadline).getTime() - new Date(a.deadline).getTime()
}

function mapRpcRow(row: ListTracksPageRow): TracksPageAppearance {
  const gameNames = jsonStringArray(row.game_names)
  const alternateTitles = jsonStringArray(row.alternate_titles)
  const sharedMusicTitles = jsonStringArray(row.shared_music_titles)
  const hasTooltip =
    Boolean(row.primary_game_slug?.trim()) ||
    alternateTitles.length > 0 ||
    sharedMusicTitles.length > 0

  return {
    track: {
      id: row.track_id,
      contest_id: row.contest_id,
      sort_order: row.sort_order,
      difficulty: row.difficulty,
      audio_path: row.audio_path,
      song_title: row.song_title,
      chosen_by_host_key: row.chosen_by_host_key,
    },
    contest: {
      id: row.contest_id,
      slug: row.contest_slug,
      title: row.contest_title,
      deadline: row.contest_deadline,
      chosenByHostKey: row.chosen_by_host_key?.trim() || null,
      chosenByDisplayName: row.chosen_by_display_name?.trim() || null,
      chosenByProfileUsername: null,
      chosenByStyleInfo: null,
    },
    answer:
      gameNames.length > 0 || row.song_title || row.notes
        ? {
            track_id: row.track_id,
            game_names: gameNames.length > 0 ? gameNames : ['Unknown'],
            song_title: row.song_title,
            notes: row.notes,
          }
        : null,
    gameTooltip: hasTooltip
      ? {
          primaryGameSlug: row.primary_game_slug,
          alternateTitles,
          sharedMusicTitles,
        }
      : undefined,
    correctGuesses: Number(row.correct_guesses) || 0,
    franchiseGuesses: Number(row.franchise_guesses) || 0,
  }
}

export function mergeTracksPageRows(appearances: TracksPageAppearance[]): TracksPageRow[] {
  const byDedupeKey = new Map<
    string,
    {
      track: Track
      contests: TracksPageContest[]
      representativeContest: TracksPageContest
      answer: TrackAnswer | null
      gameTooltip?: GameTooltip
      correctGuesses: number
      franchiseGuesses: number
      primaryGameTitle: string
    }
  >()

  for (const appearance of appearances) {
    const primaryGameTitle = appearance.answer?.game_names[0] ?? 'N/A'
    const dedupeKey = trackAppearanceDedupeKey(primaryGameTitle, appearance.track)
    const existing = byDedupeKey.get(dedupeKey)
    if (!existing) {
      byDedupeKey.set(dedupeKey, {
        track: appearance.track,
        contests: [appearance.contest],
        representativeContest: appearance.contest,
        answer: appearance.answer,
        gameTooltip: appearance.gameTooltip,
        correctGuesses: appearance.correctGuesses,
        franchiseGuesses: appearance.franchiseGuesses,
        primaryGameTitle,
      })
      continue
    }

    if (!existing.contests.some((contest) => contest.id === appearance.contest.id)) {
      existing.contests.push(appearance.contest)
    }
    existing.correctGuesses += appearance.correctGuesses
    existing.franchiseGuesses += appearance.franchiseGuesses

    if (sortContests(appearance.contest, existing.representativeContest) < 0) {
      existing.track = appearance.track
      existing.representativeContest = appearance.contest
      existing.answer = appearance.answer
      existing.gameTooltip = appearance.gameTooltip ?? existing.gameTooltip
    }
  }

  const merged = [...byDedupeKey.values()].map((entry) => ({
    track: entry.track,
    contests: entry.contests.slice().sort(sortContests),
    answer: entry.answer,
    gameTooltip: entry.gameTooltip,
    correctGuesses: entry.correctGuesses,
    franchiseGuesses: entry.franchiseGuesses,
    primaryGameTitle: entry.primaryGameTitle,
  }))

  merged.sort((left, right) => {
    const byGame = left.primaryGameTitle.localeCompare(right.primaryGameTitle, undefined, {
      sensitivity: 'base',
    })
    if (byGame !== 0) return byGame
    const leftSong = left.answer?.song_title?.trim() ?? ''
    const rightSong = right.answer?.song_title?.trim() ?? ''
    return leftSong.localeCompare(rightSong, undefined, { sensitivity: 'base' })
  })

  return merged
}

export async function fetchTracksPageBundle(): Promise<TracksPageRow[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('list_tracks_page')
  if (error) throw error
  const appearances = ((data ?? []) as ListTracksPageRow[]).map(mapRpcRow)
  const rows = mergeTracksPageRows(appearances)

  const contestIds = [...new Set(rows.flatMap((row) => row.contests.map((contest) => contest.id)))]
  if (contestIds.length === 0) return rows

  const { data: contestHostRows, error: hostsError } = await supabase
    .from('contests')
    .select(`id, ${CONTEST_HOST_EMBED_SELECT}`)
    .in('id', contestIds)
  if (hostsError) throw hostsError

  const hostsByContestId = hostsMapFromContests((contestHostRows ?? []) as ContestWithHosts[])

  return rows.map((row) => ({
    ...row,
    contests: row.contests.map((contest) => {
      const hosts = hostsByContestId.get(contest.id)
      const entry = hosts ? resolveChosenHostEntry(contest.chosenByHostKey, hosts) : null
      if (!entry) return contest
      return {
        ...contest,
        chosenByDisplayName: entry.displayName,
        chosenByProfileUsername: entry.profileUsername,
        chosenByStyleInfo: entry.profileUserId
          ? hosts?.styles.get(entry.profileUserId) ?? null
          : null,
      }
    }),
  }))
}
