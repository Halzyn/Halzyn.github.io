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

export function tracksPageNowPlayingLabel(
  trackNumber: number,
  gameTitle: string,
  trackTitle: string,
  contestTitles: string[],
): string {
  const base = `${trackNumber}. ${gameTitle} - ${trackTitle}`
  const contests = contestTitles.map((title) => title.trim()).filter(Boolean)
  return contests.length > 0 ? `${base} [${contests.join(', ')}]` : base
}

export function contestPageRevealedNowPlayingLabel(
  trackNumber: number,
  gameTitle: string,
  trackTitle: string,
): string {
  return `${trackNumber}. ${gameTitle} - ${trackTitle}`
}

export function contestPageHiddenNowPlayingLabel(track: Track): string {
  const diff = difficultyDisplayLabel(track.difficulty)
  return diff ? `${track.sort_order}. ${diff}` : `${track.sort_order}`
}

// for tracks that have appeared in multiple contests
export function trackAppearanceDedupeKey(gamePrimaryTitle: string, track: Track): string {
  const song = songOrNull(track)
  return song
    ? `${gamePrimaryTitle}\0${song.toLowerCase()}`
    : `${gamePrimaryTitle}\0__id__\0${track.id}`
}
