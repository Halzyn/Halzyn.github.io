import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { applyGlobalVolumeToAudioElement, publicAudioUrl } from '../../lib/audio'
import { useAudioVolumeSync } from '../../hooks/useAudioVolumeSync'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { getSupabase } from '../../lib/supabase'
import type { Contest, Game, Submission, Track, TrackAnswer } from '../../lib/types'
import { parseTrackAnswer } from '../../lib/trackAnswer'
import { syncTrackGameAssignments } from '../../lib/syncTrackGames'
import { parseTrackNumberFromFileName } from '../../lib/trackFileName'
import { pageTitle } from '../../lib/pageTitle'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { AdminContestSubmissions } from './AdminContestSubmissions'
import { invokeContestPublishedNotify } from '../../lib/contestPublishedNotify'
import { firstOf } from '../../lib/utils'

function mergeAnswersFromTrackGameRows(
  answersByTrackId: Record<string, TrackAnswer>,
  trackIds: string[],
  trackGameRows: unknown[],
): void {
  if (!trackIds.length || !trackGameRows.length) return

  type TrackGameRow = {
    track_id: string
    link_kind: string
    games: { id: string; primary_title: string } | { id: string; primary_title: string }[] | null
  }

  type TrackGameInfos = { primaryGameId?: string; sharedMusicGameTitles: string[] }

  const trackGameInfosByTrackId = new Map<string, TrackGameInfos>()
  for (const rawRow of trackGameRows) {
    const row = rawRow as TrackGameRow
    const game = firstOf(row.games)
    if (!game) continue
    const infos = trackGameInfosByTrackId.get(row.track_id) ?? { sharedMusicGameTitles: [] }
    if (row.link_kind === 'primary') {
      infos.primaryGameId = game.id
    } else if (row.link_kind === 'shared_music') {
      infos.sharedMusicGameTitles.push(game.primary_title)
    }
    trackGameInfosByTrackId.set(row.track_id, infos)
  }

  for (const trackId of trackIds) {
    const mergedFromTrackGame = trackGameInfosByTrackId.get(trackId)
    const existingAnswer = answersByTrackId[trackId]
    if (existingAnswer && mergedFromTrackGame?.primaryGameId) {
      answersByTrackId[trackId] = {
        ...existingAnswer,
        primary_game_id: mergedFromTrackGame.primaryGameId,
        shared_music_titles: mergedFromTrackGame.sharedMusicGameTitles.length
          ? mergedFromTrackGame.sharedMusicGameTitles
          : undefined,
      }
    }
  }
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
  const { isAdmin: isAdminUser } = useAuth()
  const { id } = useParams()
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
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [gamesCatalog, setGamesCatalog] = useState<Game[]>([])
  const [moderators, setModerators] = useState<{ user_id: string; username: string | null }[]>([])
  const [modUsername, setModUsername] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setPageError(null)

    const contestQuery = supabase.from('contests').select('*').eq('id', id).single()
    const tracksQuery = supabase
      .from('tracks')
      .select('*')
      .eq('contest_id', id)
      .order('sort_order', { ascending: true })
    const submissionsQuery = supabase
      .from('submissions')
      .select('*')
      .eq('contest_id', id)
      .order('created_at', { ascending: true })
    const gamesCatalogQuery = supabase
      .from('games')
      .select('id, primary_title, slug, created_at, updated_at')
      .order('primary_title', { ascending: true })

    const [contestResult, tracksResult, submissionsResult, gamesCatalogResult] = await Promise.all([
      contestQuery,
      tracksQuery,
      submissionsQuery,
      gamesCatalogQuery,
    ])

    if (contestResult.error || !contestResult.data) {
      setPageError(contestResult.error?.message ?? 'Not found')
      setContest(null)
      return
    }
    if (tracksResult.error) {
      setPageError(tracksResult.error.message)
      setContest(null)
      return
    }

    const loadedContest = contestResult.data as Contest
    setContest(loadedContest)
    setTitle(loadedContest.title)
    setSlug(loadedContest.slug)
    setDescription(loadedContest.description ?? '')
    setPublished(loadedContest.published)
    setResultsPublished(loadedContest.results_published ?? false)
    const deadlineUtc = new Date(loadedContest.deadline)
    const deadlineForDatetimeLocal = new Date(deadlineUtc.getTime() - deadlineUtc.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)
    setDeadline(deadlineForDatetimeLocal)

    const scheduleIso = loadedContest.scheduled_publish_at
    if (scheduleIso) {
      const scheduleUtc = new Date(scheduleIso)
      const scheduleForDatetimeLocal = new Date(
        scheduleUtc.getTime() - scheduleUtc.getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16)
      setScheduledPublishAt(scheduleForDatetimeLocal)
    } else {
      setScheduledPublishAt('')
    }
    setScheduleTagline(loadedContest.schedule_tagline ?? '')

    const trackList = (tracksResult.data ?? []) as Track[]
    setTracks(trackList)
    setSubmissions((submissionsResult.data ?? []) as Submission[])
    setGamesCatalog((gamesCatalogResult.data ?? []) as Game[])

    const trackIds = trackList.map((track) => track.id)
    let rawAnswerRows: TrackAnswer[] = []
    let trackGameJoinRows: unknown[] = []
    if (trackIds.length) {
      const trackAnswersQuery = supabase.from('track_answers').select('*').in('track_id', trackIds)
      const trackGameJoinQuery = supabase
        .from('track_game')
        .select(
          `
          track_id,
          link_kind,
          games ( id, primary_title )
        `,
        )
        .in('track_id', trackIds)
      const [answersResult, trackGameJoinResult] = await Promise.all([trackAnswersQuery, trackGameJoinQuery])
      if (answersResult.error) {
        setPageError(answersResult.error.message)
        setAnswers({})
        return
      }
      rawAnswerRows = (answersResult.data ?? []) as TrackAnswer[]
      trackGameJoinRows = trackGameJoinResult.error ? [] : (trackGameJoinResult.data ?? [])
    }

    const answersByTrackId: Record<string, TrackAnswer> = {}
    for (const rawAnswer of rawAnswerRows) {
      const answer = parseTrackAnswer(rawAnswer)
      answersByTrackId[answer.track_id] = answer
    }
    mergeAnswersFromTrackGameRows(answersByTrackId, trackIds, trackGameJoinRows)
    setAnswers(answersByTrackId)

    const { data: moderatorRows } = await supabase.from('contest_moderators').select('user_id').eq('contest_id', id)
    const moderatorUserIds = (moderatorRows ?? []).map((row) => row.user_id as string)
    if (moderatorUserIds.length === 0) {
      setModerators([])
    } else {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', moderatorUserIds)
      type ProfileRow = { id: string; username: string | null }
      setModerators(
        ((profileRows ?? []) as ProfileRow[]).map((profile) => ({
          user_id: profile.id,
          username: profile.username,
        })),
      )
    }
  }, [id, supabase])

  useEffect(() => {
    void load()
  }, [load])

  const editContestDocTitle = useMemo(() => {
    if (!contest) return pageTitle('Edit contest')
    return pageTitle('Edit contest', title.trim() || contest.title)
  }, [contest, title])

  useDocumentTitle(editContestDocTitle)

  async function addModerator(e: FormEvent) {
    e.preventDefault()
    if (!contest) return
    const normalizedUsername = modUsername.trim().toLowerCase()
    if (!normalizedUsername) return
    setPageError(null)
    const { data: profileRow, error: profileLookupError } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', normalizedUsername)
      .maybeSingle()
    if (profileLookupError || !profileRow) {
      setPageError('No profile with that username.')
      return
    }
    const { error } = await supabase.from('contest_moderators').insert({
      contest_id: contest.id,
      user_id: (profileRow as { id: string }).id,
    })
    if (error) {
      setPageError(error.message)
      return
    }
    setModUsername('')
    void load()
  }

  async function removeModerator(userId: string) {
    if (!contest) return
    setPageError(null)
    const { error } = await supabase
      .from('contest_moderators')
      .delete()
      .eq('contest_id', contest.id)
      .eq('user_id', userId)
    if (error) {
      setPageError(error.message)
      return
    }
    void load()
  }

  async function saveContest(e: FormEvent) {
    e.preventDefault()
    if (!contest) return
    const wasPublished = contest.published
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
    if (!wasPublished && published) {
      invokeContestPublishedNotify(supabase, contest.id)
    }
    void load()
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
      void load()
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
    void load()
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
    void load()
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
    void load()
    return true
  }

  if (!id) return null
  if (pageError && !contest) return <p className="banner warn">{pageError}</p>
  if (!contest) return <p className="muted">Loading...</p>

  return (
    <div className="page">
      <p className="muted small">
        <Link to="/admin/contests">← Contests</Link>
      </p>
      <h1>Edit contest</h1>
      {pageError ? <p className="banner warn">{pageError}</p> : null}

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
          <Link className="button" to={`/admin/contests/${contest.id}/grade`}>
            Grade submissions
          </Link>
          <Link className="button ghost" to={`/contests/${contest.slug}`}>
            Public page
          </Link>
        </p>
      </section>

      {isAdminUser ? (
        <section className="section">
          <h2>Contest moderators</h2>
          {moderators.length === 0 ? <p className="muted">None yet.</p> : null}
          <ul className="stack">
            {moderators.map((moderator) => (
              <li key={moderator.user_id} className="row spread panel">
                <span>{moderator.username ?? moderator.user_id}</span>
                <button
                  type="button"
                  className="button ghost small"
                  onClick={() => void removeModerator(moderator.user_id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <form className="form row-form" onSubmit={addModerator}>
            <label className="field">
              <span>Add by username</span>
              <input
                value={modUsername}
                onChange={(e) => setModUsername(e.target.value)}
                placeholder="playername"
              />
            </label>
            <button type="submit" className="button">
              Add moderator
            </button>
          </form>
        </section>
      ) : null}

      <AdminContestSubmissions
        contestId={contest.id}
        contestSlug={contest.slug}
        submissions={submissions}
        onReload={() => void load()}
        onError={setPageError}
      />

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
          {tracks.map((track) => {
            const trackAnswer = answers[track.id]
            const audioSrc = publicAudioUrl(track.audio_path)
            return (
              <li key={track.id} className="site-inset">
                <div className="site-inset-head row spread">
                  <strong>#{track.sort_order}</strong>
                  <button type="button" className="button ghost small" onClick={() => void removeTrack(track)}>
                    Delete
                  </button>
                </div>
                <div className="site-inset-body">
                  {audioSrc ? <TrackPreviewAudio src={audioSrc} /> : null}
                  <AnswerForm
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
  )
}

function AnswerForm({
  track,
  initial,
  gamesCatalog,
  isAdminUser,
  onSave,
}: {
  track: Track
  initial?: TrackAnswer
  gamesCatalog: Game[]
  isAdminUser: boolean
  onSave: (
    sortOrderInput: string,
    difficultyDraft: string,
    primaryTitle: string,
    sharedLines: string[],
    song: string,
    notes: string,
  ) => Promise<boolean>
}) {
  const listId = `game-datalist-${initial?.track_id ?? track.id}`
  const [sortOrderDraft, setSortOrderDraft] = useState(() => String(track.sort_order))
  const [difficultyDraft, setDifficultyDraft] = useState(() => track.difficulty ?? '')
  const [primaryTitle, setPrimaryTitle] = useState(() => (initial?.game_names ?? [])[0] ?? '')
  const [sharedText, setSharedText] = useState(() => (initial?.shared_music_titles ?? []).join('\n'))
  const [song, setSong] = useState(() => initial?.song_title ?? '')
  const [notes, setNotes] = useState(() => initial?.notes ?? '')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const savedTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)

  useEffect(() => {
    setSortOrderDraft(String(track.sort_order))
    setDifficultyDraft(track.difficulty ?? '')
  }, [track.id, track.sort_order, track.difficulty])

  useEffect(() => {
    setPrimaryTitle((initial?.game_names ?? [])[0] ?? '')
    setSharedText((initial?.shared_music_titles ?? []).join('\n'))
    setSong(initial?.song_title ?? '')
    setNotes(initial?.notes ?? '')
  }, [initial?.track_id, initial?.game_names, initial?.song_title, initial?.notes, initial?.shared_music_titles])

  useEffect(() => {
    return () => {
      if (savedTimerRef.current != null) window.clearTimeout(savedTimerRef.current)
    }
  }, [])

  function bumpSavedTimer() {
    if (savedTimerRef.current != null) window.clearTimeout(savedTimerRef.current)
    savedTimerRef.current = window.setTimeout(() => {
      savedTimerRef.current = null
      setSaveStatus((s) => (s === 'saved' ? 'idle' : s))
    }, 2200)
  }

  function clearSavedOnEdit() {
    setSaveStatus((s) => (s === 'saved' ? 'idle' : s))
  }

  return (
    <form
      className="form tight"
      onSubmit={(e) => {
        e.preventDefault()
        const sharedMusicLines = sharedText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
        void (async () => {
          setSaveStatus('saving')
          const ok = await onSave(
            sortOrderDraft,
            difficultyDraft,
            primaryTitle.trim(),
            sharedMusicLines,
            song,
            notes,
          )
          if (!ok) {
            setSaveStatus('idle')
            return
          }
          setSaveStatus('saved')
          bumpSavedTimer()
        })()
      }}
    >
      <div className="track-order-row">
        <label className="field row tight">
          <span className="muted">Track #</span>
          <input
            type="number"
            min={1}
            step={1}
            value={sortOrderDraft}
            onChange={(e) => {
              clearSavedOnEdit()
              setSortOrderDraft(e.target.value)
            }}
            className="track-order-input"
          />
        </label>
        <label className="field row tight">
          <span className="muted">Difficulty</span>
          <input
            value={difficultyDraft}
            onChange={(e) => {
              clearSavedOnEdit()
              setDifficultyDraft(e.target.value)
            }}
            placeholder="Easy / Medium / etc."
            className="difficulty-input"
          />
        </label>
      </div>
      <datalist id={listId}>
        {gamesCatalog.map((game) => (
          <option key={game.id} value={game.primary_title} />
        ))}
      </datalist>
      <label className="field">
        <span>Game title</span>
        <input
          list={listId}
          value={primaryTitle}
          onChange={(e) => {
            clearSavedOnEdit()
            setPrimaryTitle(e.target.value)
          }}
          maxLength={300}
          required
          placeholder="e.g. Super Mario Bros."
        />
      </label>
      {isAdminUser && initial?.primary_game_id ? (
        <p className="muted small">
          <Link to={`/admin/games/${initial.primary_game_id}`}>Edit alternate titles for this game...</Link>
        </p>
      ) : null}
      <label className="field">
        <span>Other games with the same music</span>
        <textarea
          value={sharedText}
          onChange={(e) => {
            clearSavedOnEdit()
            setSharedText(e.target.value)
          }}
          rows={3}
          placeholder={'List each game title on its own line'}
        />
      </label>
      <label className="field">
        <span>Song title</span>
        <input
          value={song}
          onChange={(e) => {
            clearSavedOnEdit()
            setSong(e.target.value)
          }}
        />
      </label>
      <label className="field">
        <span>Personal notes</span>
        <input
          value={notes}
          onChange={(e) => {
            clearSavedOnEdit()
            setNotes(e.target.value)
          }}
        />
      </label>
      <div className="row tight save-answer-actions">
        <button
          type="submit"
          className={`button small${saveStatus === 'saved' ? ' button-saved-ok' : ''}`}
          disabled={saveStatus === 'saving'}
        >
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save answer'}
        </button>
        {saveStatus === 'saved' ? (
          <span className="save-answer-hint" role="status">
            Saved.
          </span>
        ) : null}
      </div>
    </form>
  )
}
