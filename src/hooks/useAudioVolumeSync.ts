import { useEffect, type RefObject } from 'react'
import {
  applyGlobalVolumeToAudioElement,
  AUDIO_VOLUME_SYNC_EVENT,
  isApplyingProgrammaticVolume,
  writeGlobalAudioVolume,
} from '../lib/audio'

export function useAudioVolumeSync(audioRef: RefObject<HTMLAudioElement | null>, enabled: boolean): void {
  useEffect(() => {
    const audioElement = audioRef.current
    if (!audioElement || !enabled) return

    applyGlobalVolumeToAudioElement(audioElement)

    const onVol = () => {
      if (isApplyingProgrammaticVolume()) return
      writeGlobalAudioVolume(audioElement.volume)
    }
    const applyVolume = () => applyGlobalVolumeToAudioElement(audioElement)

    audioElement.addEventListener('volumechange', onVol)
    audioElement.addEventListener('loadedmetadata', applyVolume)
    window.addEventListener(AUDIO_VOLUME_SYNC_EVENT, applyVolume)

    return () => {
      audioElement.removeEventListener('volumechange', onVol)
      audioElement.removeEventListener('loadedmetadata', applyVolume)
      window.removeEventListener(AUDIO_VOLUME_SYNC_EVENT, applyVolume)
    }
  }, [audioRef, enabled])
}
