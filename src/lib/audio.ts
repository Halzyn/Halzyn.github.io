import { getSupabase } from './supabase'

export const STORAGE_AUDIO_VOLUME = 'vgmgc-audio-volume'
export const STORAGE_AUTOPLAY = 'vgmgc-autoplay'

export const AUDIO_VOLUME_SYNC_EVENT = 'vgmgc-audio-volume-sync'

function normalizeVolume(volume: number): number {
  return Math.min(1, Math.max(0, volume))
}

export function publicAudioUrl(audioPath: string): string | null {
  const { data } = getSupabase().storage.from('contest-audio').getPublicUrl(audioPath)
  return data.publicUrl
}

export function readGlobalAudioVolume(): number {
  try {
    const raw = localStorage.getItem(STORAGE_AUDIO_VOLUME)
    if (raw == null) return 1
    const volume = Number(raw)
    if (!Number.isFinite(volume)) return 1
    return normalizeVolume(volume)
  } catch {
    return 1
  }
}

export function writeGlobalAudioVolume(volume: number): void {
  try {
    const next = String(normalizeVolume(volume))
    if (localStorage.getItem(STORAGE_AUDIO_VOLUME) === next) return
    localStorage.setItem(STORAGE_AUDIO_VOLUME, next)
    window.dispatchEvent(new Event(AUDIO_VOLUME_SYNC_EVENT))
  } catch {
    return
  }
}


// FEATURED BELOW: some hacky shit to force the volume slider to sync with the volume property
let programmaticVolumeDepth = 0

export function isApplyingProgrammaticVolume(): boolean {
  return programmaticVolumeDepth > 0
}

function setVolumeWithNativeUiNudge(element: HTMLAudioElement, target: number): void {
  const v = normalizeVolume(target)
  element.volume = v
  if (v > 0 && v < 1) {
    element.volume = Math.min(1, v + 1e-6)
    element.volume = v
  } else if (v >= 1) {
    element.volume = 0.999
    element.volume = 1
  } else {
    element.volume = 0.001
    element.volume = 0
  }
}

export function appendPlaybackCacheBuster(url: string): string {
  try {
    const u = new URL(url, window.location.href)
    u.searchParams.set('_vgmgc', `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`)
    return u.href
  } catch {
    return url
  }
}

export function applyGlobalVolumeToAudioElement(element: HTMLAudioElement): void {
  programmaticVolumeDepth++
  try {
    setVolumeWithNativeUiNudge(element, readGlobalAudioVolume())

    requestAnimationFrame(() => {
      if (!element.isConnected) return
      programmaticVolumeDepth++
      try {
        setVolumeWithNativeUiNudge(element, readGlobalAudioVolume())
      } finally {
        programmaticVolumeDepth--
      }
    })
  } finally {
    programmaticVolumeDepth--
  }
}

export function readAutoplayPreference(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_AUTOPLAY)
    return raw === '1' || raw === 'true'
  } catch {
    return false
  }
}

export function writeAutoplayPreference(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_AUTOPLAY, on ? '1' : '0')
  } catch {
    return
  }
}
