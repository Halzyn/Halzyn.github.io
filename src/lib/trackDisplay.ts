import type { Track } from './types'

function songOrNull(track: Track): string | null {
  return track.song_title || null
}

export function trackLineLabel(track: Track): string {
  return songOrNull(track) ?? `Track ${track.sort_order}`
}

// for tracks that have appeared in multiple contests
export function trackAppearanceDedupeKey(gamePrimaryTitle: string, track: Track): string {
  const song = songOrNull(track)
  return song
    ? `${gamePrimaryTitle}\0${song.toLowerCase()}`
    : `${gamePrimaryTitle}\0__id__\0${track.id}`
}
