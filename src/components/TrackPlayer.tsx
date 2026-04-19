import { useMemo, useRef } from 'react'
import { publicAudioUrl } from '../lib/audioUrl'

type Props = {
  label: string
  audioPath: string
  difficulty?: string | null
}

export function TrackPlayer({ label, audioPath, difficulty }: Props) {
  const ref = useRef<HTMLAudioElement>(null)
  const src = useMemo(() => publicAudioUrl(audioPath), [audioPath])

  return (
    <article className="track-card">
      <div className="track-head">
        <h3 className="track-title">{label}</h3>
        {difficulty ? <span className="pill">{difficulty}</span> : null}
      </div>
      {src ? (
        <audio ref={ref} className="player" controls preload="metadata" src={src}>
          Your browser does not support audio.
        </audio>
      ) : (
        <p className="muted">Audio unavailable (configure Supabase).</p>
      )}
    </article>
  )
}
