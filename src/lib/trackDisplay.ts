import { difficulty } from './difficulty'
import type { Track } from './types'

function songOrNull(track: Track): string | null {
  return track.song_title || null
}

export function trackLineLabel(track: Track): string {
  return songOrNull(track) ?? `Track ${track.sort_order}`
}

function difficultyDisplayLabel(difficultyValue: string | null | undefined): string {
  const key = difficulty(difficultyValue)
  if (key === 'other') return difficultyValue?.trim() ?? ''
  return key.charAt(0).toUpperCase() + key.slice(1)
}

export type TracksPageContestLabel = {
  title: string
  chosenByDisplayName?: string | null
}

export function tracksPageNowPlayingLabel(
  trackNumber: number,
  gameTitle: string,
  trackTitle: string,
  contests: TracksPageContestLabel[],
): string {
  const base = `${trackNumber}. ${gameTitle} - ${trackTitle}`
  const parts = contests
    .map((contest) => {
      const title = contest.title.trim()
      if (!title) return ''
      const host = contest.chosenByDisplayName?.trim()
      return host ? `${title}: ${host}` : title
    })
    .filter(Boolean)
  return parts.length > 0 ? `${base} [${parts.join(', ')}]` : base
}

export function contestPageRevealedNowPlayingLabel(
  trackNumber: number,
  gameTitle: string,
  trackTitle: string,
  chosenByDisplayName?: string | null,
): string {
  const base = `${trackNumber}. ${gameTitle} - ${trackTitle}`
  const host = chosenByDisplayName?.trim()
  return host ? `${base} [${host}]` : base
}

export function contestPageHiddenNowPlayingLabel(
  track: Track,
  chosenByDisplayName?: string | null,
): string {
  const diff = difficultyDisplayLabel(track.difficulty)
  const host = chosenByDisplayName?.trim()
  if (host && diff) return `${track.sort_order}. ${host} - ${diff}`
  if (host) return `${track.sort_order}. ${host}`
  return diff ? `${track.sort_order}. ${diff}` : `${track.sort_order}`
}

// for tracks that have appeared in multiple contests
export function trackAppearanceDedupeKey(gamePrimaryTitle: string, track: Track): string {
  const song = songOrNull(track)
  return song
    ? `${gamePrimaryTitle}\0${song.toLowerCase()}`
    : `${gamePrimaryTitle}\0__id__\0${track.id}`
}
