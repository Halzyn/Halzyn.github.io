import {
  applyGlobalVolumeToAudioElement,
  AUDIO_VOLUME_SYNC_EVENT,
  readGlobalAudioVolume,
} from './audio'

export const CONTRA_THEME_URL = '/contra.mp3'

let contraAudio: HTMLAudioElement | null = null
let preloadStarted = false

function ensureContraAudio(): HTMLAudioElement {
  if (!contraAudio) {
    contraAudio = new Audio(CONTRA_THEME_URL)
    contraAudio.preload = 'auto'
  }
  return contraAudio
}

export function preloadContraTheme(): void {
  const audio = ensureContraAudio()
  applyGlobalVolumeToAudioElement(audio)
  if (preloadStarted) return
  preloadStarted = true
  audio.load()
}

function playWhenReady(audio: HTMLAudioElement): void {
  const go = () => {
    void audio.play().catch(() => {})
  }
  if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
    go()
    return
  }
  go()
  audio.addEventListener('canplay', go, { once: true })
}

export function playContraTheme(): void {
  preloadContraTheme()
  const audio = ensureContraAudio()
  applyGlobalVolumeToAudioElement(audio)
  audio.pause()
  audio.currentTime = 0
  playWhenReady(audio)
}

export function bindContraThemeVolumeSync(): () => void {
  const sync = () => {
    if (!contraAudio) return
    contraAudio.volume = readGlobalAudioVolume()
  }
  window.addEventListener(AUDIO_VOLUME_SYNC_EVENT, sync)
  return () => window.removeEventListener(AUDIO_VOLUME_SYNC_EVENT, sync)
}
