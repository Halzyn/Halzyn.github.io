import { useCallback, useEffect, useState } from 'react'
import {
  AUDIO_VOLUME_SYNC_EVENT,
  readGlobalAudioVolume,
  writeGlobalAudioVolume,
} from '../lib/audio'

export function useGlobalAudioVolume(): [number, (volume: number) => void] {
  const [volume, setVolumeState] = useState(readGlobalAudioVolume)

  useEffect(() => {
    const onSync = () => setVolumeState(readGlobalAudioVolume())
    window.addEventListener(AUDIO_VOLUME_SYNC_EVENT, onSync)
    return () => window.removeEventListener(AUDIO_VOLUME_SYNC_EVENT, onSync)
  }, [])

  const setVolume = useCallback((next: number) => {
    writeGlobalAudioVolume(next)
    setVolumeState(readGlobalAudioVolume())
  }, [])

  return [volume, setVolume]
}
