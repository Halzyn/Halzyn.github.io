import { useMemo, useRef } from 'react'
import { ContestTrackAudio, type ContestTrackAudioHandle } from '../components/ContestTrackAudio'
import { tracksListMeta } from '../lib/siteMeta'
import { usePageMeta } from '../hooks/usePageMeta'
import { useTracksPage } from '../hooks/useTracksQueries'
import { TracksGrid } from '../components/TracksGrid'

export function TracksPage() {
  const { data: rows = [], error, isPending } = useTracksPage()
  const loadError = error instanceof Error ? error.message : null
  const playerRef = useRef<ContestTrackAudioHandle>(null)
  const tracks = useMemo(() => rows.map((row) => row.track), [rows])

  usePageMeta(tracksListMeta(rows.length))

  return (
    <div className="page tracks-page">
      <h1>Tracks</h1>
      <p className="lede muted">
        This is a list of all tracks from past VGMGCs. 
      </p>
      {loadError ? <p className="banner warn">{loadError}</p> : null}
      {tracks.length > 0 ? (
        <section className="section tracks-page-player">
          <ContestTrackAudio ref={playerRef} tracks={tracks} showTrackPicker={false} />
        </section>
      ) : null}
      {isPending && rows.length === 0 && !loadError ? (
        <p className="muted">Loading tracks...</p>
      ) : (
        <TracksGrid
          rows={rows}
          onPlayTrack={(trackId) => playerRef.current?.playTrack(trackId)}
        />
      )}
    </div>
  )
}
