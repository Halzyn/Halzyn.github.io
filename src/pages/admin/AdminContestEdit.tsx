import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { applyGlobalVolumeToAudioElement, publicAudioUrl } from '../../lib/audio'
import { useAudioVolumeSync } from '../../hooks/useAudioVolumeSync'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { getSupabase } from '../../lib/supabase'
import type { Contest, Game, Submission, Track, TrackAnswer } from '../../lib/types'
import { syncTrackGameAssignments } from '../../lib/syncTrackGames'
import { parseTrackNumberFromFileName } from '../../lib/trackFileName'
import { pageTitle } from '../../lib/pageTitle'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useAdminContestEditData } from '../../hooks/useAdminContestEditData'
import { queryKeys } from '../../lib/queries/keys'
import { AdminContestSubmissions } from './AdminContestSubmissions'
import { AdminAnswerForm } from './AdminAnswerForm'
import { AdminContestAccessPanel, useContestAccess } from './AdminContestAccessPanel'
import { tabButtonClass } from '../../lib/tabButtonClass'

type ContestEditTab = 'general' | 'submissions' | 'tracks' | 'access'

const CONTEST_EDIT_TABS: { tab: Exclude<ContestEditTab, 'access'>; label: string }[] = [
  { tab: 'general', label: 'General' },
  { tab: 'submissions', label: 'Submissions' },
  { tab: 'tracks', label: 'Tracks' },
]

const CONTEST_CYCLE_DAYS = 28

function isoToDatetimeLocal(iso: string): string {
  const utc = new Date(iso)
  return new Date(utc.getTime() - utc.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function shiftDatetimeLocalByDays(value: string, days: number): string {
  if (!value.trim()) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  date.setDate(date.getDate() + days)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function TrackPreviewAudio({ src }: { src: string }) {
  const ref = useRef<HTMLAudioElement>(null)
  const didRevealRef = useRef(false)
  const [chromeRevealed, setChromeRevealed] = useState(false)

  useAudioVolumeSync(ref, Boolean(src))

  useLayoutEffect(() => {
    const audio = ref.current
    if (!audio || !src) return
    audio.pause()
    audio.src = src
    audio.load()
    applyGlobalVolumeToAudioElement(audio)
    if (!didRevealRef.current) {
      didRevealRef.current = true
      setChromeRevealed(true)
    }
  }, [src])

  useLayoutEffect(() => {
    const audio = ref.current
    if (!audio || !src || !chromeRevealed) return
    applyGlobalVolumeToAudioElement(audio)
  }, [src, chromeRevealed])

  return (
    <span style={!chromeRevealed ? { visibility: 'hidden', pointerEvents: 'none' } : undefined}>
      <audio ref={ref} className="player" controls preload="metadata" />
    </span>
  )
}

export function AdminContestEdit() {
  const supabase = getSupabase()
  const queryClient = useQueryClient()
  const { isAdmin: isAdminUser } = useAuth()
  const { id } = useParams()
  const { data, error: queryError, isLoading } = useAdminContestEditData(id)
  const [contest, setContest] = useState<Contest | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [answers, setAnswers] = useState<Record<string, TrackAnswer>>({})
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [deadline, setDeadline] = useState('')
  const [description, setDescription] = useState('')
  const [published, setPublished] = useState(false)
  const [scheduledPublishAt, setScheduledPublishAt] = useState('')
  const [scheduleTagline, setScheduleTagline] = useState('')
  const [resultsPublished, setResultsPublished] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [difficulty, setDifficulty] = useState('')
  const [batchFiles, setBatchFiles] = useState<File[]>([])
  const [batchBusy, setBatchBusy] = useState(false)
  const [reuploadingTrackId, setReuploadingTrackId] = useState<string | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [gamesCatalog, setGamesCatalog] = useState<Game[]>([])
  const [moderators, setModerators] = useState<{ user_id: string; username: string | null }[]>([])
  const [modUsername, setModUsername] = useState('')
  const [guestHosts, setGuestHosts] = useState<{ id: string; display_name: string; sort_order: number }[]>([])
  const [guestHostName, setGuestHostName] = useState('')
  const [editTab, setEditTab] = useState<ContestEditTab>('general')

  const refreshContest = useCallback(() => {
    if (!id) return
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminContest(id) })
    void queryClient.invalidateQueries({ queryKey: queryKeys.contests })
  }, [id, queryClient])

  useEffect(() => {
    if (!data) return
    setPageError(null)
    const loadedContest = data.contest
    setContest(loadedContest)
    setTitle(loadedContest.title)
    setSlug(loadedContest.slug)
    setDescription(loadedContest.description ?? '')
    setPublished(loadedContest.published)
    setResultsPublished(loadedContest.results_published ?? false)
    setDeadline(isoToDatetimeLocal(loadedContest.deadline))
    setScheduledPublishAt(
      loadedContest.scheduled_publish_at ? isoToDatetimeLocal(loadedContest.scheduled_publish_at) : '',
    )
    setScheduleTagline(loadedContest.schedule_tagline ?? '')
    setTracks(data.tracks)
    setSubmissions(data.submissions)
    setGamesCatalog(data.gamesCatalog)
    setAnswers(data.answers)
    setModerators(data.moderators)
    setGuestHosts(data.guestHosts)
  }, [data])

  useEffect(() => {
    if (!queryError) return
    setPageError(queryError instanceof Error ? queryError.message : 'Not found')
    setContest(null)
  }, [queryError])

  useEffect(() => {
    if (editTab === 'access' && !isAdminUser) {
      setEditTab('general')
    }
  }, [editTab, isAdminUser])

  const editContestDocTitle = useMemo(() => {
    if (!contest) return pageTitle('Edit contest')
    return pageTitle('Edit contest', title.trim() || contest.title)
  }, [contest, title])

  useDocumentTitle(editContestDocTitle)

  const { addModerator, removeModerator, addGuestHost, removeGuestHost } = useContestAccess(
    contest,
    refreshContest,
    setPageError,
  )

  async function saveContest(e: FormEvent) {
    e.preventDefault()
    if (!contest) return
    const { error } = await supabase
      .from('contests')
      .update({
        title: title.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        deadline: new Date(deadline).toISOString(),
        published,
        results_published: resultsPublished,
        scheduled_publish_at:
          published ? null : scheduledPublishAt.trim() ? new Date(scheduledPublishAt).toISOString() : null,
        schedule_tagline: published ? null : scheduleTagline.trim() || null,
      })
      .eq('id', contest.id)
    if (error) {
      setPageError(error.message)
      return
    }
    void refreshContest()
  }

  async function addTracksBatch(e: FormEvent) {
    e.preventDefault()
    if (!contest) return
    if (batchFiles.length === 0) {
      setPageError('Choose one or more audio files.')
      return
    }

    const filesWithTrackOrder: { file: File; order: number }[] = []
    for (const file of batchFiles) {
      const sortOrder = parseTrackNumberFromFileName(file.name)
      if (sortOrder == null) {
        setPageError(
          `Could not read track number from "${file.name}". ` +
            `Use a filename like 02.mp3 or 17.flac (digits only before the extension).`,
        )
        return
      }
      filesWithTrackOrder.push({ file, order: sortOrder })
    }

    const chosenSortOrders = filesWithTrackOrder.map((item) => item.order)
    if (new Set(chosenSortOrders).size !== chosenSortOrders.length) {
      setPageError('Two or more files map to the same track number. Rename and try again.')
      return
    }

    const takenSortOrders = new Set(tracks.map((track) => track.sort_order))
    for (const { file, order } of filesWithTrackOrder) {
      if (takenSortOrders.has(order)) {
        setPageError(
          `Track ${order} already exists (file "${file.name}"). Remove or renumber the existing track first.`,
        )
        return
      }
    }

    filesWithTrackOrder.sort((a, b) => a.order - b.order)
    const difficultyForBatch = difficulty.trim() || null
    setPageError(null)
    setBatchBusy(true)

    const failBatchUploadAndReload = (message: string) => {
      setPageError(message)
      setBatchBusy(false)
      void refreshContest()
    }

    for (const { file, order } of filesWithTrackOrder) {
      const fileExtension = file.name.includes('.') ? file.name.split('.').pop() : 'mp3'
      const objectPath = `${contest.id}/${crypto.randomUUID()}.${fileExtension}`
      const { error: uploadError } = await supabase.storage.from('contest-audio').upload(objectPath, file, {
        contentType: file.type || 'audio/mpeg',
      })
      if (uploadError) {
        failBatchUploadAndReload(`Upload failed for "${file.name}": ${uploadError.message}`)
        return
      }
      const { error: insertTrackError } = await supabase.from('tracks').insert({
        contest_id: contest.id,
        sort_order: order,
        difficulty: difficultyForBatch,
        audio_path: objectPath,
      })
      if (insertTrackError) {
        await supabase.storage.from('contest-audio').remove([objectPath])
        failBatchUploadAndReload(`Could not save "${file.name}" as track ${order}: ${insertTrackError.message}`)
        return
      }
    }

    setBatchFiles([])
    setBatchBusy(false)
    void refreshContest()
  }

  async function reuploadTrackAudio(track: Track, file: File) {
    if (!contest) return
    setPageError(null)
    setReuploadingTrackId(track.id)
    const oldPath = track.audio_path
    const fileExtension = file.name.includes('.') ? file.name.split('.').pop() : 'mp3'
    const objectPath = `${contest.id}/${crypto.randomUUID()}.${fileExtension}`

    const { error: uploadError } = await supabase.storage.from('contest-audio').upload(objectPath, file, {
      contentType: file.type || 'audio/mpeg',
    })
    if (uploadError) {
      setPageError(`Upload failed: ${uploadError.message}`)
      setReuploadingTrackId(null)
      return
    }

    const { error: updateError } = await supabase
      .from('tracks')
      .update({ audio_path: objectPath })
      .eq('id', track.id)
    if (updateError) {
      await supabase.storage.from('contest-audio').remove([objectPath])
      setPageError(updateError.message)
      setReuploadingTrackId(null)
      return
    }

    const { error: storageErr } = await supabase.storage.from('contest-audio').remove([oldPath])
    if (storageErr) {
      console.warn('Old audio file could not be removed from storage:', storageErr)
    }

    setReuploadingTrackId(null)
    void refreshContest()
  }

  async function swapTrackOrder(a: Track, b: Track) {
    setPageError(null)
    const tempOrder = Math.max(...tracks.map((track) => track.sort_order), 0) + 1000

    const { error: moveAtoTempError } = await supabase
      .from('tracks')
      .update({ sort_order: tempOrder })
      .eq('id', a.id)
    if (moveAtoTempError) {
      setPageError(moveAtoTempError.message)
      return
    }

    const { error: moveBtoAError } = await supabase
      .from('tracks')
      .update({ sort_order: a.sort_order })
      .eq('id', b.id)
    if (moveBtoAError) {
      setPageError(moveBtoAError.message)
      void refreshContest()
      return
    }

    const { error: moveAtoBError } = await supabase
      .from('tracks')
      .update({ sort_order: b.sort_order })
      .eq('id', a.id)
    if (moveAtoBError) {
      setPageError(moveAtoBError.message)
      void refreshContest()
      return
    }

    void refreshContest()
  }

  async function removeTrack(t: Track) {
    if (!window.confirm(`Delete track ${t.sort_order}?`)) return
    const { error } = await supabase.from('tracks').delete().eq('id', t.id)
    if (error) {
      setPageError(error.message)
      return
    }
    const { error: storageErr } = await supabase.storage.from('contest-audio').remove([t.audio_path])
    if (storageErr) {
      console.warn('Audio file could not be removed from storage:', storageErr)
    }
    void refreshContest()
  }

  async function saveTrackAndAnswer(
    trackId: string,
    sortOrderInput: string,
    difficultyDraft: string,
    primaryTitle: string,
    sharedLines: string[],
    song: string,
    notes: string,
  ): Promise<boolean> {
    const nextSortOrder = parseInt(sortOrderInput, 10)
    if (!Number.isFinite(nextSortOrder) || nextSortOrder < 1) {
      setPageError('Track number must be an integer higher than zero.')
      return false
    }
    if (!primaryTitle) {
      setPageError('Game title is required.')
      return false
    }
    setPageError(null)

    const { error: trackUpdateError } = await supabase
      .from('tracks')
      .update({
        sort_order: nextSortOrder,
        difficulty: difficultyDraft || null,
      })
      .eq('id', trackId)

    if (trackUpdateError) {
      const isSortOrderConflict =
        trackUpdateError.code === '23505' ||
        /duplicate|unique/i.test(trackUpdateError.message ?? '')
      setPageError(
        isSortOrderConflict
          ? 'That track number is already used in this contest. Pick another or renumber the other track first.'
          : trackUpdateError.message,
      )
      return false
    }

    const assignmentSync = await syncTrackGameAssignments(supabase, trackId, primaryTitle, sharedLines)
    if (assignmentSync.error) {
      setPageError(assignmentSync.error)
      return false
    }
    const { error: answersError } = await supabase
      .from('track_answers')
      .update({
        song_title: song || null,
        notes: notes || null,
      })
      .eq('track_id', trackId)
    if (answersError) {
      setPageError(answersError.message)
      return false
    }
    void refreshContest()
    return true
  }

  if (!id) return null
  if (pageError && !contest) return <p className="banner warn">{pageError}</p>
  if (isLoading && !contest) return <p className="muted">Loading...</p>
  if (!contest) return <p className="muted">Loading...</p>

  return (
    <div className="page">
      <p className="muted small">
        <Link to="/admin/contests">← Contests</Link>
      </p>
      <h1>Edit contest</h1>
      {pageError ? <p className="banner warn">{pageError}</p> : null}

      <div
        className="row tight site-toolbar profile-edit-tabs"
        role="tablist"
        aria-label="Contest sections"
      >
        {CONTEST_EDIT_TABS.map(({ tab, label }) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`contest-tab-${tab}`}
            aria-selected={editTab === tab}
            aria-controls={`contest-panel-${tab}`}
            className={tabButtonClass(editTab === tab)}
            onClick={() => setEditTab(tab)}
          >
            {label}
          </button>
        ))}
        <Link
          to={`/admin/contests/${contest.id}/grade`}
          className={tabButtonClass(false)}
          role="tab"
          id="contest-tab-grid"
        >
          Grid
        </Link>
        {isAdminUser ? (
          <button
            type="button"
            role="tab"
            id="contest-tab-access"
            aria-selected={editTab === 'access'}
            aria-controls="contest-panel-access"
            className={tabButtonClass(editTab === 'access')}
            onClick={() => setEditTab('access')}
          >
            Access
          </button>
        ) : null}
      </div>

      <div
        id="contest-panel-general"
        role="tabpanel"
        aria-labelledby="contest-tab-general"
        hidden={editTab !== 'general'}
        className="profile-edit-tab-panel"
      >
      <section className="section">
        <h2>Contest settings</h2>
        <form className="form" onSubmit={saveContest}>
          <label className="field">
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label className="field">
            <span>Slug</span>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} required />
          </label>
          <label className="field">
            <span>Deadline</span>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </label>
          <label className="field">
            <span>Scheduled go-live</span>
            <input
              type="datetime-local"
              value={scheduledPublishAt}
              onChange={(e) => setScheduledPublishAt(e.target.value)}
              disabled={published}
            />
          </label>
          <p className="muted small">
            Contest will automatically go live at this time.
          </p>
          <div className="row tight">
            <button
              type="button"
              className="button ghost small"
              onClick={() => {
                setDeadline((current) => shiftDatetimeLocalByDays(current, CONTEST_CYCLE_DAYS))
                if (!published && scheduledPublishAt.trim()) {
                  setScheduledPublishAt((current) => shiftDatetimeLocalByDays(current, CONTEST_CYCLE_DAYS))
                }
              }}
            >
              +{CONTEST_CYCLE_DAYS} days
            </button>
          </div>
          <p className="muted small">
            Shifts the deadline{published ? '' : ' and scheduled go-live'} by one contest cycle. Save contest to
            apply.
          </p>
          <label className="field">
            <span>Tagline</span>
            <textarea
              value={scheduleTagline}
              onChange={(e) => setScheduleTagline(e.target.value)}
              rows={2}
              disabled={published}
              placeholder="A little blurb about the contest to get people hyped"
            />
          </label>
          <label className="field row">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => {
                const next = e.target.checked
                setPublished(next)
                if (next) {
                  setScheduledPublishAt('')
                  setScheduleTagline('')
                }
              }}
            />
            <span>Published contest</span>
          </label>
          <label className="field row">
            <input
              type="checkbox"
              checked={resultsPublished}
              onChange={(e) => setResultsPublished(e.target.checked)}
            />
            <span>Published results</span>
          </label>
          <p className="muted small">
            Toggle to make the answer grid and rankings visible to the public.
          </p>
          <button type="submit" className="button primary">
            Save contest
          </button>
        </form>

        <p>
          <Link className="button ghost" to={`/contests/${contest.slug}`}>
            Public page
          </Link>
        </p>
      </section>
      </div>

      <div
        id="contest-panel-submissions"
        role="tabpanel"
        aria-labelledby="contest-tab-submissions"
        hidden={editTab !== 'submissions'}
        className="profile-edit-tab-panel"
      >
        <AdminContestSubmissions
          contestId={contest.id}
          contestSlug={contest.slug}
          submissions={submissions}
          onReload={() => void refreshContest()}
          onError={setPageError}
        />
      </div>

      <div
        id="contest-panel-tracks"
        role="tabpanel"
        aria-labelledby="contest-tab-tracks"
        hidden={editTab !== 'tracks'}
        className="profile-edit-tab-panel"
      >
      <section className="section">
        <h2>Upload tracks</h2>
        <p className="muted small site-section-blurb">
          Select multiple files at once. Each filename must be digits only, then the extension (e.g.{' '}
          <code>02.mp3</code>, <code>17.mp3</code>). That becomes track <strong>2</strong> and{' '}
          <strong>17</strong>. Leading zeros are trimmed. You can set the difficulty field here to apply it to every uploaded file in this batch.
        </p>
        <div className="site-inset site-upload-panel">
          <div className="site-inset-body">
            <form className="form" onSubmit={addTracksBatch}>
              <label className="field">
                <span>Difficulty</span>
                <input
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  placeholder="Easy / Medium / etc."
                />
              </label>
              <label className="field">
                <span>Audio files</span>
                <input
                  type="file"
                  accept="audio/*"
                  multiple
                  onChange={(e) => setBatchFiles(Array.from(e.target.files ?? []))}
                />
              </label>
              {batchFiles.length > 0 ? (
                <ul className="batch-preview muted small">
                  {batchFiles.map((file, index) => {
                    const parsedTrackNumber = parseTrackNumberFromFileName(file.name)
                    return (
                      <li key={`${index}-${file.name}-${file.lastModified}`}>
                        <code>{file.name}</code>
                        {parsedTrackNumber != null ? (
                          <>
                            {' '}
                            = track <strong>{parsedTrackNumber}</strong>
                          </>
                        ) : (
                          <> is an invalid name</>
                        )}
                      </li>
                    )
                  })}
                </ul>
              ) : null}
              <button type="submit" className="button primary" disabled={batchBusy || batchFiles.length === 0}>
                {batchBusy
                  ? 'Uploading...'
                  : `Upload ${batchFiles.length} track${batchFiles.length === 1 ? '' : 's'}`}
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Tracks & answers</h2>
        {tracks.length === 0 ? <p className="muted">No tracks yet.</p> : null}
        <ul className="stack">
          {tracks.map((track, trackIndex) => {
            const trackAnswer = answers[track.id]
            const audioSrc = publicAudioUrl(track.audio_path)
            const isReuploading = reuploadingTrackId === track.id
            return (
              <li key={track.id} className="site-inset">
                <div className="site-inset-head row spread">
                  <div className="row tight track-order-head">
                    <strong>#{track.sort_order}</strong>
                    <div className="track-reorder-buttons row tight">
                      <button
                        type="button"
                        className="button ghost small"
                        disabled={trackIndex === 0}
                        onClick={() => void swapTrackOrder(track, tracks[trackIndex - 1])}
                        aria-label={`Move track ${track.sort_order} up`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="button ghost small"
                        disabled={trackIndex === tracks.length - 1}
                        onClick={() => void swapTrackOrder(track, tracks[trackIndex + 1])}
                        aria-label={`Move track ${track.sort_order} down`}
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                  <button type="button" className="button ghost small" onClick={() => void removeTrack(track)}>
                    Delete
                  </button>
                </div>
                <div className="site-inset-body">
                  {audioSrc ? <TrackPreviewAudio src={audioSrc} /> : null}
                  <label className="field row tight track-reupload">
                    <span className="muted small">Replace audio</span>
                    <input
                      type="file"
                      accept="audio/*"
                      disabled={isReuploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        e.target.value = ''
                        if (file) void reuploadTrackAudio(track, file)
                      }}
                    />
                    {isReuploading ? <span className="muted small">Uploading...</span> : null}
                  </label>
                  <AdminAnswerForm
                    key={track.id}
                    track={track}
                    initial={trackAnswer}
                    gamesCatalog={gamesCatalog}
                    isAdminUser={isAdminUser}
                    onSave={(sortOrderInput, difficultyDraft, primaryTitle, sharedLines, songTitle, personalNotes) =>
                      saveTrackAndAnswer(
                        track.id,
                        sortOrderInput,
                        difficultyDraft,
                        primaryTitle,
                        sharedLines,
                        songTitle,
                        personalNotes,
                      )
                    }
                  />
                </div>
              </li>
            )
          })}
        </ul>
      </section>
      </div>

      {isAdminUser ? (
        <div
          id="contest-panel-access"
          role="tabpanel"
          aria-labelledby="contest-tab-access"
          hidden={editTab !== 'access'}
          className="profile-edit-tab-panel"
        >
          <AdminContestAccessPanel
            moderators={moderators}
            guestHosts={guestHosts}
            modUsername={modUsername}
            guestHostName={guestHostName}
            onModUsernameChange={setModUsername}
            onGuestHostNameChange={setGuestHostName}
            onAddModerator={(event) => void addModerator(event, modUsername, () => setModUsername(''))}
            onRemoveModerator={removeModerator}
            onAddGuestHost={(event) =>
              void addGuestHost(event, guestHostName, guestHosts, () => setGuestHostName(''))
            }
            onRemoveGuestHost={removeGuestHost}
          />
        </div>
      ) : null}
    </div>
  )
}
