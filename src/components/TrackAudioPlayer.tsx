import { forwardRef, useImperativeHandle, useMemo } from 'react'
import { useTrackAudioEngine, type TrackPlaybackState } from '../hooks/useTrackAudioEngine'
import type { Track } from '../lib/types'
import { SiteAudioPlayer } from './SiteAudioPlayer'

export type TrackAudioPlayerHandle = {
  playTrack: (trackId: string) => void
  selectTrack: (trackId: string, options?: { play?: boolean }) => void
  togglePlayPause: () => void
  goPrev: () => void
  goNext: () => void
}

export type { TrackPlaybackState }

type TrackAudioPlayerProps = {
  tracks: Track[]
  onPlaybackChange?: (state: TrackPlaybackState) => void
  onActiveTrackChange?: (trackId: string | null) => void
  getNowPlayingLabel?: (track: Track) => string | null | undefined
  className?: string
}

export const TrackAudioPlayer = forwardRef<TrackAudioPlayerHandle, TrackAudioPlayerProps>(
  function TrackAudioPlayer(
    { tracks, onPlaybackChange, onActiveTrackChange, getNowPlayingLabel, className },
    ref,
  ) {
    const engine = useTrackAudioEngine({ tracks, onPlaybackChange, onActiveTrackChange })

    useImperativeHandle(
      ref,
      () => ({
        playTrack: engine.playTrack,
        selectTrack: engine.selectTrack,
        togglePlayPause: engine.togglePlayPause,
        goPrev: engine.goPrev,
        goNext: engine.goNext,
      }),
      [engine.playTrack, engine.selectTrack, engine.togglePlayPause, engine.goPrev, engine.goNext],
    )

    const activeTrack = useMemo(
      () => (engine.activeId ? (tracks.find((track) => track.id === engine.activeId) ?? null) : null),
      [engine.activeId, tracks],
    )

    const nowPlayingText = useMemo(() => {
      if (!activeTrack || !getNowPlayingLabel) return null
      return getNowPlayingLabel(activeTrack) ?? null
    }, [activeTrack, getNowPlayingLabel])

    if (tracks.length === 0) return null

    return (
      <div className={className ? `track-audio-player ${className}` : 'track-audio-player'}>
        <audio ref={engine.audioRef} className="track-audio-player-element" preload="auto" />
        {engine.hasAudio ? (
          <SiteAudioPlayer
            isPlaying={engine.wantsPlayback}
            canPrev={engine.canGoPrev}
            canNext={engine.canGoNext}
            currentTime={engine.currentTime}
            duration={engine.duration}
            autoplay={engine.autoplayNext}
            nowPlayingText={nowPlayingText}
            nowPlayingKey={engine.activeId}
            onPlayPause={engine.togglePlayPause}
            onPrev={engine.goPrev}
            onNext={engine.goNext}
            onSeek={engine.seek}
            onAutoplayChange={engine.setAutoplay}
          />
        ) : (
          <p className="muted small">Audio unavailable.</p>
        )}
      </div>
    )
  },
)
