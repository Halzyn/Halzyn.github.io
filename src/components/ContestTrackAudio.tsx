import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Track } from '../lib/types'
import { publicAudioUrl } from '../lib/audio'
import { trackLineLabel } from '../lib/trackDisplay'
import {
  TrackAudioPlayer,
  type TrackAudioPlayerHandle,
  type TrackPlaybackState,
} from './TrackAudioPlayer'

export type ListContestLink = { title: string; slug: string }

export type ContestTrackAudioHandle = TrackAudioPlayerHandle

export type { TrackPlaybackState }

type Props = {
  tracks: Track[]
  listRowContests?: ListContestLink[][]
  showTrackPicker?: boolean
  onPlaybackChange?: (state: TrackPlaybackState) => void
  onActiveTrackChange?: (trackId: string | null) => void
}

export const ContestTrackAudio = forwardRef<ContestTrackAudioHandle, Props>(function ContestTrackAudio(
  { tracks, listRowContests, showTrackPicker = true, onPlaybackChange, onActiveTrackChange },
  ref,
) {
  const playerRef = useRef<TrackAudioPlayerHandle>(null)
  const [trackPlayback, setTrackPlayback] = useState<TrackPlaybackState>({
    activeId: null,
    isPlaying: false,
  })
  const listMode = showTrackPicker && Boolean(listRowContests && listRowContests.length === tracks.length)

  const handlePlaybackChange = useCallback(
    (state: TrackPlaybackState) => {
      setTrackPlayback(state)
      onPlaybackChange?.(state)
    },
    [onPlaybackChange],
  )

  useImperativeHandle(
    ref,
    () => ({
      playTrack: (trackId: string) => {
        playerRef.current?.playTrack(trackId)
      },
      selectTrack: (trackId: string, options?: { play?: boolean }) => {
        playerRef.current?.selectTrack(trackId, options)
      },
      togglePlayPause: () => {
        playerRef.current?.togglePlayPause()
      },
      goPrev: () => {
        playerRef.current?.goPrev()
      },
      goNext: () => {
        playerRef.current?.goNext()
      },
    }),
    [],
  )

  if (tracks.length === 0) return null

  return (
    <div className={listMode ? 'tracks-player-shell tracks-player-shell--list' : 'tracks-player-shell'}>
      {showTrackPicker && listMode ? (
        <ul className="game-track-line-list" role="list">
          {tracks.map((track, index) => {
            const url = publicAudioUrl(track.audio_path)
            const active = track.id === trackPlayback.activeId
            const playing = active && trackPlayback.isPlaying
            const contests = listRowContests![index]!
            const difficulty = track.difficulty ?? ''
            const label = trackLineLabel(track)
            return (
              <li key={track.id} className={`game-track-line${active ? ' game-track-line-active' : ''}`}>
                <button
                  type="button"
                  className="game-track-line-play"
                  disabled={!url}
                  aria-label={url ? (playing ? `Pause ${label}` : `Play ${label}`) : 'Audio unavailable'}
                  aria-pressed={playing}
                  onClick={() => playerRef.current?.playTrack(track.id)}
                >
                  <span aria-hidden>{playing ? '⏸' : '▷'}</span>
                </button>
                <span className="game-track-line-title">{label}</span>
                <span className="game-track-line-sep" aria-hidden>
                  ◦
                </span>
                <span className="game-track-line-contest muted">
                  {contests.map((contest, contestIndex) => (
                    <span key={contest.slug} className="game-track-line-contest-item">
                      {contestIndex > 0 ? (
                        <span className="game-track-line-sep game-track-line-sep--in-contest" aria-hidden>
                          {' ◦ '}
                        </span>
                      ) : null}
                      <Link className="game-track-line-contest-link" to={`/contests/${contest.slug}`}>
                        {contest.title}
                      </Link>
                    </span>
                  ))}
                </span>
                {difficulty ? (
                  <>
                    <span className="game-track-line-sep" aria-hidden>
                      ◦
                    </span>
                    <span className="game-track-line-diff muted">{difficulty}</span>
                  </>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : showTrackPicker ? (
        <div className="track-pick-grid" role="list">
          {tracks.map((track) => {
            const url = publicAudioUrl(track.audio_path)
            const active = track.id === trackPlayback.activeId
            const playing = active && trackPlayback.isPlaying
            return (
              <div
                key={track.id}
                className={`track-pick-cell${active ? ' track-pick-cell-active' : ''}`}
                role="listitem"
              >
                <span className="track-pick-num">#{track.sort_order}</span>
                {track.difficulty ? (
                  <span className="track-pick-diff muted tiny" title={track.difficulty}>
                    {track.difficulty}
                  </span>
                ) : null}
                <button
                  type="button"
                  className="track-pick-play"
                  disabled={!url}
                  aria-label={
                    url
                      ? playing
                        ? `Pause track ${track.sort_order}`
                        : `Play track ${track.sort_order}`
                      : 'Audio unavailable'
                  }
                  aria-pressed={playing}
                  onClick={() => playerRef.current?.playTrack(track.id)}
                >
                  <span
                    className={`track-pick-play-icon${playing ? ' track-pick-play-icon--pause' : ''}`}
                    aria-hidden
                  >
                    {playing ? '⏸' : '▶'}
                  </span>
                </button>
              </div>
            )
          })}
        </div>
      ) : null}

      <TrackAudioPlayer
        ref={playerRef}
        tracks={tracks}
        onPlaybackChange={handlePlaybackChange}
        onActiveTrackChange={onActiveTrackChange}
        className="tracks-player-audio"
      />
    </div>
  )
})
