import type { TrackAnswer } from './types'

export function parseTrackAnswer(raw: unknown): TrackAnswer {
  const rawTrack = raw as Record<string, unknown>
  const names = rawTrack.game_names
  return {
    track_id: String(rawTrack.track_id),
    game_names: Array.isArray(names) && names.length ? (names as string[]) : ['Unknown'],
    song_title: (rawTrack.song_title as string | null | undefined) ?? null,
    notes: (rawTrack.notes as string | null | undefined) ?? null,
  }
}
