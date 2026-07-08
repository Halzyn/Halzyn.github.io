import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  appendPlaybackCacheBuster,
  applyGlobalVolumeToAudioElement,
  publicAudioUrl,
  readAutoplayPreference,
  writeAutoplayPreference,
} from '../lib/audio'
import type { Track } from '../lib/types'
import { useAudioVolumeSync } from './useAudioVolumeSync'

export type TrackPlaybackState = {
  activeId: string | null
  isPlaying: boolean
}

type UseTrackAudioEngineOptions = {
  tracks: Track[]
  onPlaybackChange?: (state: TrackPlaybackState) => void
  onActiveTrackChange?: (trackId: string | null) => void
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

function adjacentPlayableTrackId(
  previousId: string,
  tracks: Track[],
  urlById: Map<string, string | null>,
  direction: 1 | -1,
): string | null {
  const index = tracks.findIndex((track) => track.id === previousId)
  if (index < 0) return null
  if (direction > 0) {
    for (let i = index + 1; i < tracks.length; i++) {
      const track = tracks[i]!
      if (urlById.get(track.id)) return track.id
    }
  } else {
    for (let i = index - 1; i >= 0; i--) {
      const track = tracks[i]!
      if (urlById.get(track.id)) return track.id
    }
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

export function useTrackAudioEngine({
  tracks,
  onPlaybackChange,
  onActiveTrackChange,
}: UseTrackAudioEngineOptions) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const playIntentRef = useRef(false)
  const bindGenerationRef = useRef(0)
  const playAfterBindRef = useRef(false)
  const pauseConfirmRef = useRef<number | null>(null)
  const didRevealRef = useRef(false)

  const [activeId, setActiveIdState] = useState<string | null>(null)
  const [wantsPlayback, setWantsPlayback] = useState(false)
  const [autoplayNext, setAutoplayNext] = useState(readAutoplayPreference)
  const [revealed, setRevealed] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const urlById = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const track of tracks) map.set(track.id, publicAudioUrl(track.audio_path))
    return map
  }, [tracks])

  const setActiveId = useCallback(
    (trackId: string | null) => {
      setActiveIdState(trackId)
      onActiveTrackChange?.(trackId)
    },
    [onActiveTrackChange],
  )

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

  useEffect(() => {
    if (tracks.length === 0) {
      setActiveId(null)
      return
    }
    if (activeId && urlById.get(activeId)) return
    setActiveId(tracks.find((track) => urlById.get(track.id))?.id ?? null)
  }, [tracks, urlById, activeId, setActiveId])

  const activeSrc = activeId ? (urlById.get(activeId) ?? null) : null
  const activeIndex = activeId ? tracks.findIndex((track) => track.id === activeId) : -1

  const canGoPrev = useMemo(() => {
    if (activeIndex <= 0) return false
    return tracks.slice(0, activeIndex).some((track) => Boolean(urlById.get(track.id)))
  }, [activeIndex, tracks, urlById])

  const canGoNext = useMemo(() => {
    if (activeIndex < 0 || activeIndex >= tracks.length - 1) return false
    return tracks.slice(activeIndex + 1).some((track) => Boolean(urlById.get(track.id)))
  }, [activeIndex, tracks, urlById])

  const toggleOrRecoverSameTrack = useCallback(
    (trackId: string, url: string): boolean => {
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
    },
    [activeId, markPaused, markPlaying],
  )

  useAudioVolumeSync(audioRef, Boolean(activeSrc))

  useEffect(() => {
    onPlaybackChange?.({ activeId, isPlaying: wantsPlayback })
  }, [activeId, wantsPlayback, onPlaybackChange])

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
    const onTimeUpdate = () => setCurrentTime(audioElement.currentTime)
    const onDurationChange = () => {
      setDuration(Number.isFinite(audioElement.duration) ? audioElement.duration : 0)
    }

    audioElement.addEventListener('play', onPlay)
    audioElement.addEventListener('pause', onStop)
    audioElement.addEventListener('ended', onStop)
    audioElement.addEventListener('timeupdate', onTimeUpdate)
    audioElement.addEventListener('loadedmetadata', onDurationChange)
    audioElement.addEventListener('durationchange', onDurationChange)

    return () => {
      audioElement.removeEventListener('play', onPlay)
      audioElement.removeEventListener('pause', onStop)
      audioElement.removeEventListener('ended', onStop)
      audioElement.removeEventListener('timeupdate', onTimeUpdate)
      audioElement.removeEventListener('loadedmetadata', onDurationChange)
      audioElement.removeEventListener('durationchange', onDurationChange)
      clearPendingPause()
    }
  }, [clearPendingPause, markPlaying])

  useLayoutEffect(() => {
    const audioElement = audioRef.current
    if (!audioElement) return

    if (!activeSrc) {
      bindGenerationRef.current++
      playAfterBindRef.current = false
      markPaused()
      setCurrentTime(0)
      setDuration(0)
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
    setCurrentTime(0)

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
    if (!audioElement || !autoplayNext || !activeSrc) return

    const onEnded = () => {
      const previous = activeId
      if (!previous) return
      const next = adjacentPlayableTrackId(previous, tracks, urlById, 1)
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
  }, [autoplayNext, activeSrc, activeId, tracks, urlById, markPaused, markPlaying, setActiveId])

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
    [markPlaying, setActiveId, toggleOrRecoverSameTrack, urlById],
  )

  const selectTrack = useCallback(
    (trackId: string, options?: { play?: boolean }) => {
      const url = urlById.get(trackId)
      if (!url) return
      if (options?.play === false) {
        playIntentRef.current = false
        playAfterBindRef.current = false
        markPaused()
        setActiveId(trackId)
        return
      }
      beginTrackPlayback(trackId)
    },
    [beginTrackPlayback, markPaused, setActiveId, urlById],
  )

  const goAdjacent = useCallback(
    (direction: 1 | -1) => {
      if (!activeId) return
      const next = adjacentPlayableTrackId(activeId, tracks, urlById, direction)
      if (!next) return
      beginTrackPlayback(next)
    },
    [activeId, beginTrackPlayback, tracks, urlById],
  )

  const seek = useCallback((time: number) => {
    const element = audioRef.current
    if (!element || !Number.isFinite(time)) return
    const max = Number.isFinite(element.duration) ? element.duration : 0
    element.currentTime = Math.max(0, Math.min(time, max))
    setCurrentTime(element.currentTime)
  }, [])

  const setAutoplay = useCallback((on: boolean) => {
    setAutoplayNext(on)
    writeAutoplayPreference(on)
  }, [])

  return {
    audioRef,
    activeId,
    activeSrc,
    wantsPlayback,
    currentTime,
    duration,
    canGoPrev,
    canGoNext,
    autoplayNext,
    playTrack: beginTrackPlayback,
    selectTrack,
    togglePlayPause: useCallback(() => {
      if (!activeId) {
        const first = tracks.find((track) => urlById.get(track.id))?.id
        if (first) beginTrackPlayback(first)
        return
      }
      const url = urlById.get(activeId)
      if (!url) return
      toggleOrRecoverSameTrack(activeId, url)
    }, [activeId, beginTrackPlayback, toggleOrRecoverSameTrack, tracks, urlById]),
    goPrev: useCallback(() => goAdjacent(-1), [goAdjacent]),
    goNext: useCallback(() => goAdjacent(1), [goAdjacent]),
    seek,
    setAutoplay,
    hasAudio: Boolean(activeSrc),
  }
}
