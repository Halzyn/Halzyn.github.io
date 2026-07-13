import { useEffect, type RefObject } from 'react'
import type { TrackAudioPlayerHandle } from '../components/TrackAudioPlayer'
import type { Track } from '../lib/types'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

function hasModifierKeys(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.metaKey || event.altKey
}

function trackForNumberKey(tracks: Track[], key: string): Track | null {
  if (key >= '1' && key <= '9') {
    const order = Number(key)
    return tracks.find((track) => track.sort_order === order) ?? null
  }
  if (key === '0') {
    return tracks.find((track) => track.sort_order === 10) ?? null
  }
  return null
}

type UseContestEntryKeyboardOptions = {
  enabled: boolean
  tracks: Track[]
  playerRef: RefObject<TrackAudioPlayerHandle | null>
  guessInputRef: RefObject<HTMLInputElement | null>
  focusGuessOnTrackJump: boolean
  onSelectTrack: (trackId: string) => void
}

export function useContestEntryKeyboard({
  enabled,
  tracks,
  playerRef,
  guessInputRef,
  focusGuessOnTrackJump,
  onSelectTrack,
}: UseContestEntryKeyboardOptions): void {
  useEffect(() => {
    if (!enabled) return

    function onKeyDown(event: KeyboardEvent) {
      if (hasModifierKeys(event)) return

      const typing = isEditableTarget(event.target)

      if (event.key === ' ' || event.code === 'Space') {
        if (typing) return
        event.preventDefault()
        playerRef.current?.togglePlayPause()
        return
      }

      if (event.key === 'ArrowLeft') {
        if (typing) return
        event.preventDefault()
        playerRef.current?.goPrev()
        return
      }

      if (event.key === 'ArrowRight') {
        if (typing) return
        event.preventDefault()
        playerRef.current?.goNext()
        return
      }

      const track = trackForNumberKey(tracks, event.key)
      if (!track || typing) return

      event.preventDefault()
      onSelectTrack(track.id)
      if (focusGuessOnTrackJump) {
        requestAnimationFrame(() => {
          guessInputRef.current?.focus()
        })
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [enabled, tracks, playerRef, guessInputRef, focusGuessOnTrackJump, onSelectTrack])
}
