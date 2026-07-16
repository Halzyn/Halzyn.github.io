import { useMemo, useRef } from 'react'
import { ContestTrackAudio, type ContestTrackAudioHandle } from '../components/ContestTrackAudio'
import { LoadingState } from '../components/LoadingState'
import { tracksListMeta } from '../lib/siteMeta'
import { usePageMeta } from '../hooks/usePageMeta'
import { useTracksPage } from '../hooks/useTracksQueries'
import { TracksGrid } from '../components/TracksGrid'
import { trackLineLabel, tracksPageNowPlayingLabel } from '../lib/trackDisplay'

export function TracksPage() {
  const { data: rows = [], error, isPending } = useTracksPage()
  const loadError = error instanceof Error ? error.message : null
  const playerRef = useRef<ContestTrackAudioHandle>(null)
  const tracks = useMemo(() => rows.map((row) => row.track), [rows])

  const getNowPlayingLabel = useMemo(() => {
    const labelsByTrackId = new Map<string, string>()
    for (const [index, row] of rows.entries()) {
      const gameTitle = row.primaryGameTitle
      const trackTitle = row.answer?.song_title?.trim() || trackLineLabel(row.track)
      const contestTitles = row.contests.map((contest) => contest.title)
      labelsByTrackId.set(
        row.track.id,
        tracksPageNowPlayingLabel(index + 1, gameTitle, trackTitle, contestTitles),
      )
    }
    return (track: (typeof tracks)[number]) => labelsByTrackId.get(track.id) ?? null
  }, [rows, tracks])

  usePageMeta(tracksListMeta(rows.length))

  return (
    <div className="page tracks-page">
      <h1>Tracks</h1>
      <p className="lede muted">
        This is a list of all tracks from past VGMGCs. 
      </p>
      {loadError ? <p className="banner warn">{loadError}</p> : null}
      {tracks.length > 0 ? (
        <section className="section sticky-page-player">
          <ContestTrackAudio
            ref={playerRef}
            tracks={tracks}
            showTrackPicker={false}
            getNowPlayingLabel={getNowPlayingLabel}
          />
        </section>
      ) : null}
      {isPending && rows.length === 0 && !loadError ? (
        <LoadingState label="Loading tracks..." />
      ) : (
        <TracksGrid
          rows={rows}
          onPlayTrack={(trackId) => playerRef.current?.playTrack(trackId)}
        />
      )}
    </div>
  )
}
