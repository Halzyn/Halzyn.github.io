import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link } from 'react-router-dom'
import type { Track } from '../lib/types'
import {
  appendPlaybackCacheBuster,
  applyGlobalVolumeToAudioElement,
  publicAudioUrl,
  readAutoplayPreference,
  writeAutoplayPreference,
} from '../lib/audio'
import { trackLineLabel } from '../lib/trackDisplay'
import { useAudioVolumeSync } from '../hooks/useAudioVolumeSync'

export type ListContestLink = { title: string; slug: string }

export type ContestTrackAudioHandle = {
  playTrack: (trackId: string) => void
}

export type TrackPlaybackState = {
  activeId: string | null
  isPlaying: boolean
}

type Props = {
  tracks: Track[]
  listRowContests?: ListContestLink[][]
  showTrackPicker?: boolean
  showAutoplay?: boolean
  onPlaybackChange?: (state: TrackPlaybackState) => void
}

function hardRebindTrackSource(audio: HTMLAudioElement, src: string): void {
  audio.pause()
  audio.removeAttribute('src')
  void audio.load()
  audio.src = src
  void audio.load()
}

function trackNotLoading(audio: HTMLAudioElement): boolean {
  return audio.error != null || audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA
}

function nextPlayableTrackId(
  previousId: string,
  tracks: Track[],
  urlById: Map<string, string | null>,
): string | null {
  const index = tracks.findIndex((track) => track.id === previousId)
  if (index < 0) return null
  for (let i = index + 1; i < tracks.length; i++) {
    const track = tracks[i]!
    if (urlById.get(track.id)) return track.id
  }
  return null
}

function queueDeferredPlay(audio: HTMLAudioElement, isAlive: () => boolean, signal?: AbortSignal): void {
  queueMicrotask(() => {
    if (!isAlive()) return
    const go = () => {
      if (!isAlive()) return
      void audio.play().catch(() => {})
    }
    if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      queueMicrotask(go)
    } else {
      audio.addEventListener('canplay', go, { once: true, signal })
    }
  })
}

function recoverTrackWithCacheBust(audio: HTMLAudioElement, baseUrl: string, play: boolean): void {
  hardRebindTrackSource(audio, appendPlaybackCacheBuster(baseUrl))
  queueMicrotask(() => {
    applyGlobalVolumeToAudioElement(audio)
    if (play) {
      queueDeferredPlay(audio, () => audio.isConnected)
    }
  })
}

export const ContestTrackAudio = forwardRef<ContestTrackAudioHandle, Props>(function ContestTrackAudio(
  { tracks, listRowContests, showTrackPicker = true, showAutoplay = true, onPlaybackChange },
  ref,
) {
  const listMode = showTrackPicker && Boolean(listRowContests && listRowContests.length === tracks.length)
  const audioRef = useRef<HTMLAudioElement>(null)
  const playIntentRef = useRef(false)
  const bindGenerationRef = useRef(0)
  const playAfterBindRef = useRef(false)
  const pauseConfirmRef = useRef<number | null>(null)
  const didRevealRef = useRef(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [wantsPlayback, setWantsPlayback] = useState(false)
  const [autoplayNext, setAutoplayNext] = useState(readAutoplayPreference)
  const [revealed, setRevealed] = useState(false)

  const clearPendingPause = useCallback(() => {
    if (pauseConfirmRef.current != null) {
      window.clearTimeout(pauseConfirmRef.current)
      pauseConfirmRef.current = null
    }
  }, [])

  const markPlaying = useCallback(() => {
    clearPendingPause()
    setWantsPlayback(true)
  }, [clearPendingPause])

  const markPaused = useCallback(() => {
    clearPendingPause()
    setWantsPlayback(false)
  }, [clearPendingPause])

  const urlById = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const track of tracks) map.set(track.id, publicAudioUrl(track.audio_path))
    return map
  }, [tracks])

  useEffect(() => {
    if (tracks.length === 0) {
      setActiveId(null)
      return
    }
    if (activeId && urlById.get(activeId)) return
    setActiveId(tracks.find((track) => urlById.get(track.id))?.id ?? null)
  }, [tracks, urlById, activeId])

  const activeSrc = activeId ? (urlById.get(activeId) ?? null) : null

  const toggleOrRecoverSameTrack = useCallback((trackId: string, url: string): boolean => {
    const element = audioRef.current
    if (activeId !== trackId || !element) return false
    if (element.paused) {
      markPlaying()
      if (trackNotLoading(element)) {
        playAfterBindRef.current = true
        recoverTrackWithCacheBust(element, url, true)
      } else {
        void element.play().catch(() => {})
      }
    } else {
      playAfterBindRef.current = false
      playIntentRef.current = false
      markPaused()
      element.pause()
    }
    return true
  }, [activeId, markPaused, markPlaying])

  useAudioVolumeSync(audioRef, Boolean(activeSrc))

  useEffect(() => {
    const audioElement = audioRef.current
    if (!audioElement) return

    const onPlay = () => {
      playAfterBindRef.current = false
      markPlaying()
    }
    const onStop = () => {
      if (playIntentRef.current || playAfterBindRef.current) return
      if (audioElement.seeking) return

      clearPendingPause()
      pauseConfirmRef.current = window.setTimeout(() => {
        pauseConfirmRef.current = null
        if (playIntentRef.current || playAfterBindRef.current) return
        const element = audioRef.current
        if (!element || !element.paused || element.seeking) return
        setWantsPlayback(false)
      }, 120)
    }

    audioElement.addEventListener('play', onPlay)
    audioElement.addEventListener('pause', onStop)
    audioElement.addEventListener('ended', onStop)

    return () => {
      audioElement.removeEventListener('play', onPlay)
      audioElement.removeEventListener('pause', onStop)
      audioElement.removeEventListener('ended', onStop)
      clearPendingPause()
    }
  }, [clearPendingPause, markPlaying])

  useEffect(() => {
    onPlaybackChange?.({ activeId, isPlaying: wantsPlayback })
  }, [activeId, wantsPlayback, onPlaybackChange])

  useLayoutEffect(() => {
    const audioElement = audioRef.current
    if (!audioElement) return

    if (!activeSrc) {
      bindGenerationRef.current++
      playAfterBindRef.current = false
      markPaused()
      audioElement.pause()
      audioElement.removeAttribute('src')
      audioElement.load()
      return
    }

    const generation = ++bindGenerationRef.current
    const abortController = new AbortController()

    const wantPlay = playIntentRef.current
    playIntentRef.current = false
    playAfterBindRef.current = wantPlay
    if (wantPlay) {
      markPlaying()
    }

    hardRebindTrackSource(audioElement, activeSrc)

    if (!didRevealRef.current) {
      didRevealRef.current = true
      setRevealed(true)
    }

    if (wantPlay) {
      queueDeferredPlay(audioElement, () => bindGenerationRef.current === generation, abortController.signal)
    }

    return () => {
      abortController.abort()
    }
  }, [activeId, activeSrc, markPaused, markPlaying])

  useLayoutEffect(() => {
    const audioElement = audioRef.current
    if (!audioElement || !activeSrc || !revealed) return
    applyGlobalVolumeToAudioElement(audioElement)
  }, [activeId, activeSrc, revealed])

  useEffect(() => {
    const audioElement = audioRef.current
    if (!showAutoplay || !audioElement || !autoplayNext || !activeSrc) return

    const onEnded = () => {
      const previous = activeId
      if (!previous) return
      const next = nextPlayableTrackId(previous, tracks, urlById)
      if (next) {
        playIntentRef.current = true
        playAfterBindRef.current = true
        markPlaying()
        setActiveId(next)
        return
      }
      markPaused()
    }

    audioElement.addEventListener('ended', onEnded, { capture: true })
    return () => audioElement.removeEventListener('ended', onEnded, { capture: true })
  }, [showAutoplay, autoplayNext, activeSrc, activeId, tracks, urlById, markPaused, markPlaying])

  useEffect(() => {
    const element = audioRef.current
    if (!element || !activeSrc) return

    const genAtSubscribe = bindGenerationRef.current

    const onError = () => {
      if (bindGenerationRef.current !== genAtSubscribe) return
      playAfterBindRef.current = true
      markPlaying()
      recoverTrackWithCacheBust(element, activeSrc, true)
    }

    element.addEventListener('error', onError, { once: true })
    return () => element.removeEventListener('error', onError)
  }, [activeId, activeSrc, markPlaying])

  useEffect(() => {
    const element = audioRef.current
    if (!element || !activeSrc) return
    const gen = bindGenerationRef.current
    const timeout = window.setTimeout(() => {
      if (bindGenerationRef.current !== gen) return
      if (element.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return
      recoverTrackWithCacheBust(element, activeSrc, playAfterBindRef.current)
    }, 2000)
    return () => window.clearTimeout(timeout)
  }, [activeId, activeSrc])

  const beginTrackPlayback = useCallback(
    (trackId: string) => {
      const url = urlById.get(trackId)
      if (!url) return
      if (toggleOrRecoverSameTrack(trackId, url)) return
      playIntentRef.current = true
      markPlaying()
      setActiveId(trackId)
    },
    [markPlaying, toggleOrRecoverSameTrack, urlById],
  )

  const selectTrack = useCallback(
    (track: Track) => {
      beginTrackPlayback(track.id)
    },
    [beginTrackPlayback],
  )

  useImperativeHandle(
    ref,
    () => ({
      playTrack: beginTrackPlayback,
    }),
    [beginTrackPlayback],
  )

  if (tracks.length === 0) return null

  const wrapHidden = Boolean(activeSrc && !revealed)

  const audioElement = (
    <>
      <audio
        ref={audioRef}
        className="tracks-universal-audio"
        controls
        preload="auto"
        hidden={!activeSrc}
      />
      {!activeSrc ? <p className="muted small">Audio unavailable.</p> : null}
    </>
  )

  return (
    <div className={listMode ? 'tracks-player-shell tracks-player-shell--list' : 'tracks-player-shell'}>
      {showTrackPicker && listMode ? (
        <ul className="game-track-line-list" role="list">
          {tracks.map((track, index) => {
            const url = urlById.get(track.id)
            const active = track.id === activeId
            const playing = active && wantsPlayback
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
                  onClick={() => selectTrack(track)}
                >
                  <span aria-hidden>{playing ? '⏸' : '▷'}</span>
                </button>
                <span className="game-track-line-title">{label}</span>
                <span className="game-track-line-sep" aria-hidden>
                  ·
                </span>
                <span className="game-track-line-contest">
                  {contests.map((contest, contestIndex) => (
                    <span key={contest.slug} className="game-track-line-contest-item">
                      {contestIndex > 0 ? (
                        <span className="game-track-line-sep game-track-line-sep--in-contest" aria-hidden>
                          {' / '}
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
                      ·
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
            const url = urlById.get(track.id)
            const active = track.id === activeId
            const playing = active && wantsPlayback
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
                    url ? (playing ? `Pause track ${track.sort_order}` : `Play track ${track.sort_order}`) : 'Audio unavailable'
                  }
                  aria-pressed={playing}
                  onClick={() => selectTrack(track)}
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

      <div className="tracks-universal-audio-row">
        <div
          className="tracks-universal-audio-wrap"
          style={wrapHidden ? { visibility: 'hidden', pointerEvents: 'none' } : undefined}
          aria-hidden={wrapHidden || undefined}
        >
          {audioElement}
        </div>
        {showAutoplay ? (
          <label
            className="contest-autoplay-label"
            title="When on, the next track plays after the current one finishes."
          >
            <input
              type="checkbox"
              checked={autoplayNext}
              onChange={(e) => {
                const next = e.target.checked
                setAutoplayNext(next)
                writeAutoplayPreference(next)
              }}
            />
            <span>Autoplay</span>
          </label>
        ) : null}
      </div>
    </div>
  )
})
