import { useGlobalAudioVolume } from '../hooks/useGlobalAudioVolume'

type SiteAudioPlayerProps = {
  isPlaying: boolean
  disabled?: boolean
  canPrev: boolean
  canNext: boolean
  currentTime: number
  duration: number
  autoplay: boolean
  onPlayPause: () => void
  onPrev: () => void
  onNext: () => void
  onSeek: (time: number) => void
  onAutoplayChange: (on: boolean) => void
}

function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  const remainder = total % 60
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

export function SiteAudioPlayer({
  isPlaying,
  disabled = false,
  canPrev,
  canNext,
  currentTime,
  duration,
  autoplay,
  onPlayPause,
  onPrev,
  onNext,
  onSeek,
  onAutoplayChange,
}: SiteAudioPlayerProps) {
  const [volume, setVolume] = useGlobalAudioVolume()
  const scrubMax = duration > 0 ? duration : 0
  const scrubValue = scrubMax > 0 ? Math.min(currentTime, scrubMax) : 0

  return (
    <div className="site-audio-player" aria-disabled={disabled || undefined}>
      <div className="site-audio-player-transport">
        <button
          type="button"
          className="site-audio-player-btn site-audio-player-btn-ghost"
          disabled={disabled || !canPrev}
          aria-label="Previous track"
          onClick={onPrev}
        >
          <span aria-hidden>⏮</span>
        </button>
        <button
          type="button"
          className="site-audio-player-btn site-audio-player-btn-primary"
          disabled={disabled}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          aria-pressed={isPlaying}
          onClick={onPlayPause}
        >
          <span aria-hidden>{isPlaying ? '⏸' : '▶'}</span>
        </button>
        <button
          type="button"
          className="site-audio-player-btn site-audio-player-btn-ghost"
          disabled={disabled || !canNext}
          aria-label="Next track"
          onClick={onNext}
        >
          <span aria-hidden>⏭</span>
        </button>
      </div>

      <div className="site-audio-player-scrub">
        <span className="site-audio-player-time">{formatPlaybackTime(currentTime)}</span>
        <input
          type="range"
          className="site-audio-player-scrub-input"
          min={0}
          max={scrubMax}
          step={0.05}
          value={scrubValue}
          disabled={disabled || scrubMax <= 0}
          aria-label="Playback position"
          aria-valuemin={0}
          aria-valuemax={scrubMax}
          aria-valuenow={scrubValue}
          onChange={(event) => onSeek(Number(event.target.value))}
        />
        <span className="site-audio-player-time">{formatPlaybackTime(duration)}</span>
      </div>

      <label className="site-audio-player-volume" title="Volume">
        <span className="site-audio-player-volume-label">Vol</span>
        <input
          type="range"
          className="site-audio-player-volume-input"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          aria-label="Volume"
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
        />
      </label>

      <label
        className="site-audio-player-autoplay"
        title="When on, the next track plays after the current one finishes."
      >
        <input
          type="checkbox"
          checked={autoplay}
          onChange={(event) => onAutoplayChange(event.target.checked)}
        />
        <span>Autoplay</span>
      </label>
    </div>
  )
}
