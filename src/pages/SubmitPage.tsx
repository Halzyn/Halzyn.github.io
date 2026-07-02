import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  ContestTrackAudio,
  type ContestTrackAudioHandle,
  type TrackPlaybackState,
} from '../components/ContestTrackAudio'
import { pageTitle } from '../lib/pageTitle'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { publicAudioUrl } from '../lib/audio'
import { getSupabase } from '../lib/supabase'
import type { Contest, Track } from '../lib/types'
import { contestClosed } from '../lib/deadline'
import { difficulty, type Difficulty } from '../lib/difficulty'

type TrackDifficultyGroup = {
  difficultyKey: Difficulty
  heading: string
  tracks: Track[]
}

function groupTracksByDifficulty(trackList: Track[]): TrackDifficultyGroup[] {
  const groups: TrackDifficultyGroup[] = []
  for (const track of trackList) {
    const difficultyKey = difficulty(track.difficulty)
    const last = groups[groups.length - 1]
    if (last?.difficultyKey === difficultyKey) {
      last.tracks.push(track)
    } else {
      groups.push({
        difficultyKey,
        heading: track.difficulty?.trim() || 'Other',
        tracks: [track],
      })
    }
  }
  return groups
}

type EditDraftPayload = {
  submission_id?: string
  contestant_name?: string
  user_id?: string | null
  guesses?: { track_id: string; text: string }[]
}

type AdminDraftPayload = {
  contest_id?: string
} & EditDraftPayload

type SubmitContestPayload = {
  submission_id?: string
  edit_token?: string | null
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function submissionIdFromSearchParam(value: string | null): string {
  const raw = value ?? ''
  return UUID_PATTERN.test(raw) ? raw : ''
}

function contestantNameFromDraft(row: EditDraftPayload): string {
  return row.contestant_name ?? ''
}

function guessMapFromDraft(row: EditDraftPayload): Map<string, string> {
  const map = new Map<string, string>()
  for (const entry of row.guesses ?? []) {
    map.set(entry.track_id, entry.text ?? '')
  }
  return map
}

function mergeDraftIntoGuessesState(
  draftByTrack: Map<string, string>,
  trackList: Track[],
  previous: Record<string, string>,
): Record<string, string> {
  const next: Record<string, string> = {}
  for (const t of trackList) {
    next[t.id] = draftByTrack.get(t.id) ?? previous[t.id] ?? ''
  }
  return next
}

export function SubmitPage() {
  const supabase = getSupabase()
  const { ready, userId, isAdmin, profile } = useAuth()
  const { slug } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editToken = searchParams.get('edit') ?? ''
  const adminSubmissionId = useMemo(
    () => submissionIdFromSearchParam(searchParams.get('admin_submission')),
    [searchParams],
  )

  const [contest, setContest] = useState<Contest | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [name, setName] = useState('')
  const [guesses, setGuesses] = useState<Record<string, string>>({})
  const [pageError, setPageError] = useState<string | null>(null)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [draftLoading, setDraftLoading] = useState(false)
  const [nameReadOnly, setNameReadOnly] = useState(false)
  const [useAdminApi, setUseAdminApi] = useState(false)
  const [ownerClosedOutcome, setOwnerClosedOutcome] = useState<'unset' | 'none' | 'readonly'>('unset')
  const [editSubmissionUserId, setEditSubmissionUserId] = useState<string | null | undefined>(undefined)
  const [claiming, setClaiming] = useState(false)
  const tracksPlayerRef = useRef<ContestTrackAudioHandle>(null)
  const [trackPlayback, setTrackPlayback] = useState<TrackPlaybackState>({
    activeId: null,
    isPlaying: false,
  })

  const audioUrlByTrackId = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const track of tracks) map.set(track.id, publicAudioUrl(track.audio_path))
    return map
  }, [tracks])

  const trackGroups = useMemo(() => groupTracksByDifficulty(tracks), [tracks])

  const profileDisplayNameForSubmit = useMemo(() => {
    const trimmed = profile?.display_name?.trim()
    return trimmed ? trimmed : null
  }, [profile?.display_name])

  const submitDocTitle = useMemo(() => {
    if (!slug || !contest) return pageTitle('Submit')
    return pageTitle('Submit', contest.title)
  }, [slug, contest])

  useDocumentTitle(submitDocTitle)

  useEffect(() => {
    if (!ready || editToken || adminSubmissionId || !userId) return
    if (profileDisplayNameForSubmit) setName(profileDisplayNameForSubmit)
  }, [ready, editToken, adminSubmissionId, userId, profileDisplayNameForSubmit])

  useEffect(() => {
    setOwnerClosedOutcome('unset')
  }, [contest?.id])

  useEffect(() => {
    if (!contest || tracks.length === 0 || adminSubmissionId || editToken || !userId || !ready) return

    let cancelled = false
    setDraftLoading(true)
    setPageError(null)
    void (async () => {
      const { data, error } = await supabase.rpc('get_submission_for_owner', {
        p_contest_id: contest.id,
      })
      if (cancelled) return
      setDraftLoading(false)
      const closed = contestClosed(contest.deadline)
      if (error) {
        setPageError(error.message)
        return
      }
      if (data === null || data === undefined) {
        if (closed && !isAdmin) setOwnerClosedOutcome('none')
        else setOwnerClosedOutcome('unset')
        return
      }
      const row = data as EditDraftPayload
      setNameReadOnly(true)
      setName(contestantNameFromDraft(row))
      const draftByTrack = guessMapFromDraft(row)
      setGuesses((prev) => mergeDraftIntoGuessesState(draftByTrack, tracks, prev))
      if (closed && !isAdmin) setOwnerClosedOutcome('readonly')
      else setOwnerClosedOutcome('unset')
    })()

    return () => {
      cancelled = true
    }
  }, [supabase, contest, tracks, editToken, adminSubmissionId, userId, ready, isAdmin])

  useEffect(() => {
    if (!slug) return
    void (async () => {
      const { data: contestRow, error: contestError } = await supabase
        .from('contests')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()
      if (contestError || !contestRow) {
        setContest(null)
        return
      }
      const loadedContest = contestRow as Contest
      setContest(loadedContest)
      const { data: trackRows } = await supabase
        .from('tracks')
        .select('*')
        .eq('contest_id', loadedContest.id)
        .order('sort_order', { ascending: true })
      const trackList = (trackRows ?? []) as Track[]
      setTracks(trackList)
      const empty: Record<string, string> = {}
      for (const track of trackList) empty[track.id] = ''
      setGuesses(empty)
    })()
  }, [slug, supabase])

  useEffect(() => {
    if (!contest || tracks.length === 0 || !adminSubmissionId) return
    if (!ready) return
    if (!isAdmin) {
      setNameReadOnly(false)
      setDraftLoading(false)
      setUseAdminApi(false)
      return
    }
    let cancelled = false
    setDraftLoading(true)
    setPageError(null)
    setUseAdminApi(true)
    void (async () => {
      const { data, error } = await supabase.rpc('admin_get_submission_draft', {
        p_submission_id: adminSubmissionId,
      })
      if (cancelled) return
      setDraftLoading(false)
      if (error) {
        setNameReadOnly(false)
        setUseAdminApi(false)
        setPageError(error.message)
        return
      }
      const row = data as AdminDraftPayload
      if (row.contest_id !== contest.id) {
        setNameReadOnly(false)
        setUseAdminApi(false)
        setPageError('This submission is not for this contest.')
        return
      }
      setNameReadOnly(true)
      setName(contestantNameFromDraft(row))
      const draftByTrack = guessMapFromDraft(row)
      setGuesses((prev) => mergeDraftIntoGuessesState(draftByTrack, tracks, prev))
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, contest, tracks, isAdmin, ready, adminSubmissionId])

  useEffect(() => {
    if (!contest || tracks.length === 0 || adminSubmissionId) return

    if (contestClosed(contest.deadline)) {
      if (!ready) return
      if (!isAdmin) {
        if (!editToken && userId) return
        if (!editToken && !userId) {
          setNameReadOnly(false)
          setDraftLoading(false)
          return
        }
      }
    }

    if (!editToken) {
      setUseAdminApi(false)
      setEditSubmissionUserId(undefined)
      if (!userId) {
        setNameReadOnly(false)
        setDraftLoading(false)
      }
      return
    }

    let cancelled = false
    setDraftLoading(true)
    setPageError(null)
    void (async () => {
      const { data, error } = await supabase.rpc('get_submission_for_edit', {
        p_contest_id: contest.id,
        p_edit_token: editToken,
      })
      if (cancelled) return
      setDraftLoading(false)
      if (error) {
        setNameReadOnly(false)
        setPageError(error.message)
        return
      }
      const row = data as EditDraftPayload
      setNameReadOnly(true)
      setName(contestantNameFromDraft(row))
      setEditSubmissionUserId(row.user_id ?? null)
      const draftByTrack = guessMapFromDraft(row)
      setGuesses((prev) => mergeDraftIntoGuessesState(draftByTrack, tracks, prev))
      const closed = contestClosed(contest.deadline)
      if (closed && !isAdmin) setOwnerClosedOutcome('readonly')
      else setOwnerClosedOutcome('unset')
    })()

    return () => {
      cancelled = true
    }
  }, [supabase, contest, tracks, editToken, isAdmin, ready, adminSubmissionId, userId])

  async function handleClaimSubmission() {
    if (!contest || !editToken || !userId) return
    setClaiming(true)
    setPageError(null)
    setSaveNotice(null)
    try {
      const { data, error } = await supabase.rpc('claim_submission_for_edit', {
        p_contest_id: contest.id,
        p_edit_token: editToken,
      })
      if (error) {
        setPageError(error.message)
        return
      }
      setEditSubmissionUserId(userId)
      const result = data as { already_claimed?: boolean } | null
      if (result?.already_claimed) {
        setSaveNotice('This submission is already linked to your account.')
      } else {
        setSaveNotice(
          'Submission linked to your account. You can keep editing here or open Submit while signed in next time.',
        )
      }
    } finally {
      setClaiming(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!contest || ownerClosedOutcome === 'readonly') return
    if (contestClosed(contest.deadline) && !isAdmin) {
      setPageError('Submissions are closed.')
      return
    }
    setSubmitting(true)
    setPageError(null)
    setSaveNotice(null)
    const guessPayload = tracks.map((t) => ({
      track_id: t.id,
      text: guesses[t.id] ?? '',
    }))

    try {
      if (useAdminApi && adminSubmissionId) {
        const { error } = await supabase.rpc('admin_update_submission_guesses', {
          p_submission_id: adminSubmissionId,
          p_guesses: guessPayload,
        })
        if (error) {
          setPageError(error.message)
          return
        }
        setSaveNotice('Saved.')
        return
      }

      const { data, error } = await supabase.rpc('submit_contest_entry', {
        p_contest_id: contest.id,
        p_contestant_name: name.trim(),
        p_guesses: guessPayload,
        p_edit_token: editToken.length > 0 ? editToken : null,
      })
      if (error) {
        setPageError(error.message)
        return
      }
      const res = data as SubmitContestPayload
      const tokenFromResponse =
        typeof res.edit_token === 'string' && res.edit_token.length > 0 ? res.edit_token : null
      const nextEditToken = tokenFromResponse ?? (editToken.length > 0 ? editToken : null)
      if (nextEditToken) {
        navigate(`/contests/${contest.slug}/submit?edit=${encodeURIComponent(nextEditToken)}`, { replace: true })
        setSaveNotice('Saved. Bookmark this page or keep the address so you can change your guesses later.')
      } else {
        navigate(`/contests/${contest.slug}`, { replace: true })
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!slug) return null
  if (!contest) {
    return (
      <div className="page">
        <p>Contest not found.</p>
        <Link to="/">Home</Link>
      </div>
    )
  }

  const closed = contestClosed(contest.deadline)
  const ownerClosedReadOnly = closed && ownerClosedOutcome === 'readonly'
  const needAdminInfo = closed || Boolean(adminSubmissionId)
  const showAdminChecking = needAdminInfo && !ready
  const showClosedToVisitor =
    closed &&
    ready &&
    !isAdmin &&
    !adminSubmissionId &&
    (!userId || ownerClosedOutcome === 'none')
  const showAdminSignIn = Boolean(adminSubmissionId) && ready && !isAdmin

  const canUseForm =
    tracks.length > 0 &&
    (!closed || isAdmin || ownerClosedReadOnly) &&
    (!adminSubmissionId || (isAdmin && !draftLoading && useAdminApi))

  const showAdminDraftError =
    Boolean(adminSubmissionId) && isAdmin && ready && !draftLoading && pageError && !useAdminApi

  const sessionLocksName = Boolean(userId) && !adminSubmissionId && !useAdminApi
  const nameInputDisabled = draftLoading || nameReadOnly || sessionLocksName || ownerClosedReadOnly
  const missingDisplayNameWhileSignedIn =
    Boolean(userId) && ready && !profileDisplayNameForSubmit && !editToken && !adminSubmissionId

  const showClaimSubmission =
    Boolean(userId) &&
    ready &&
    Boolean(editToken) &&
    !adminSubmissionId &&
    !draftLoading &&
    editSubmissionUserId === null &&
    canUseForm &&
    !ownerClosedReadOnly

  function renderTopBanner(): React.ReactNode {
    if (showAdminChecking) {
      return <p className="muted">Checking sign in...</p>
    }
    if (showAdminSignIn) {
      return (
        <p className="banner warn">
          You do not have access to this submission.
        </p>
      )
    }
    if (draftLoading && closed && Boolean(userId) && !isAdmin && !editToken && !adminSubmissionId) {
      return <p className="muted">Loading your entry...</p>
    }
    if (
      pageError &&
      closed &&
      userId &&
      !isAdmin &&
      !adminSubmissionId &&
      ownerClosedOutcome === 'unset' &&
      !draftLoading &&
      !canUseForm
    ) {
      return <p className="banner warn">{pageError}</p>
    }
    if (showClosedToVisitor) {
      return <p className="banner warn">This contest is closed.</p>
    }
    if (showAdminDraftError) {
      return <p className="banner warn">{pageError}</p>
    }
    return null
  }

  function renderIntroCopy(): ReactNode {
    if (editToken && !adminSubmissionId) {
      return (
        <>
          Update your guesses below.
        </>
      )
    }
    if (useAdminApi) {
      return <>You are editing this entrant's submission.</>
    }
    if (ownerClosedReadOnly) {
      return <>This contest is closed. You can no longer change your submission.</>
    }
    if (sessionLocksName && ready) {
      return (
        <>
          Submit your guesses below. You can come back to this page while the contest is open to update guesses.
          The first time you submit you will still receive a private edit link if you want a second way back here.
        </>
      )
    }
    return (
      <>
        Submit your guesses below. The first time you submit, you will get a <strong>private edit link</strong>.
        Bookmark that page or save the address! This way only you can change your answers later. If someone else
        already uses the display name you want, you will be asked to pick a different name unless you have that
        person's edit link.
      </>
    )
  }

  return (
    <div className="page narrow submit-page">
      <h1>Submit — {contest.title}</h1>
      {renderTopBanner()}
      {canUseForm ? (
        <>
          {closed && isAdmin && !adminSubmissionId ? (
            <p className="banner">
              why are you here
            </p>
          ) : null}
          {isAdmin && adminSubmissionId ? (
            <p className="banner">
              Editing this submission in place.
            </p>
          ) : null}
          {ownerClosedReadOnly ? (
            <p className="banner">
              This contest is closed. You can no longer change your submission.{' '}
              <Link to={`/contests/${contest.slug}`}>Open contest page</Link>
              {contest.results_published ? <> for the results.</> : null}
            </p>
          ) : null}
          {missingDisplayNameWhileSignedIn ? (
            <p className="banner warn">
              Add a display name under <Link to="/profile/edit">Edit profile</Link> before you can submit while signed
              in.
            </p>
          ) : null}
          <p className="muted">
            {renderIntroCopy()}
            {!ownerClosedReadOnly ? (
              <>
                {' '}
                Use the track order shown on the contest page. You can leave tracks blank, and they will be ignored. If
                you'd rather send me your submissions directly, you can DM me on Discord @halzyn.
              </>
            ) : null}
          </p>
          {tracks.length > 0 ? (
            <ContestTrackAudio
              ref={tracksPlayerRef}
              tracks={tracks}
              showTrackPicker={false}
              showAutoplay={false}
              onPlaybackChange={setTrackPlayback}
            />
          ) : null}
          {draftLoading ? <p className="muted">Loading your saved entry...</p> : null}
          <form className="form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Your name (public on rankings after the deadline)</span>
              <div className="submit-name-row">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  required={!missingDisplayNameWhileSignedIn}
                  disabled={nameInputDisabled}
                  className={nameInputDisabled ? 'submit-name-locked' : undefined}
                  autoComplete="nickname"
                />
                {showClaimSubmission ? (
                  <button
                    type="button"
                    className="button"
                    disabled={claiming || submitting}
                    onClick={() => void handleClaimSubmission()}
                  >
                    {claiming ? 'Linking...' : 'Claim submission'}
                  </button>
                ) : null}
              </div>
            </label>
            {trackGroups.map((group, groupIndex) => (
              <section
                key={`${group.difficultyKey}-${group.tracks[0]?.id ?? groupIndex}`}
                className="submit-difficulty-section"
              >
                <h3 className="submit-difficulty-heading">{group.heading}</h3>
                {group.tracks.map((t) => {
                  const trackAudioUrl = audioUrlByTrackId.get(t.id)
                  const trackLabel = `Track ${t.sort_order}`
                  const playing = trackPlayback.activeId === t.id && trackPlayback.isPlaying
                  return (
                    <label key={t.id} className="field row submit-track-row">
                      <button
                        type="button"
                        className="submit-track-play"
                        disabled={!trackAudioUrl}
                        aria-label={
                          trackAudioUrl ? (playing ? `Pause ${trackLabel}` : `Play ${trackLabel}`) : 'Audio unavailable'
                        }
                        aria-pressed={playing}
                        onClick={() => tracksPlayerRef.current?.playTrack(t.id)}
                      >
                        <span aria-hidden>{playing ? '⏸' : '▷'}</span>
                      </button>
                      <span className="submit-track-num">{t.sort_order}.</span>
                      <input
                        value={guesses[t.id] ?? ''}
                        onChange={(e) => setGuesses((g) => ({ ...g, [t.id]: e.target.value }))}
                        maxLength={500}
                        placeholder="Game title / notes"
                        disabled={draftLoading || ownerClosedReadOnly}
                        className={ownerClosedReadOnly ? 'submit-name-locked' : undefined}
                      />
                    </label>
                  )
                })}
              </section>
            ))}
            {saveNotice ? (
              <p className="banner success" role="status">
                {saveNotice}
              </p>
            ) : null}
            {pageError ? <p className="banner warn">{pageError}</p> : null}
            <div className="actions">
              {ownerClosedReadOnly ? null : (
                <button
                  type="submit"
                  className="button primary"
                  disabled={
                    submitting ||
                    draftLoading ||
                    (Boolean(adminSubmissionId) && !isAdmin) ||
                    missingDisplayNameWhileSignedIn
                  }
                >
                  {submitting ? 'Sending...' : editToken || useAdminApi ? 'Update entry' : 'Send entry'}
                </button>
              )}
              <Link to={`/contests/${contest.slug}`} className="button ghost">
                {ownerClosedReadOnly ? 'Contest page' : 'Cancel'}
              </Link>
            </div>
          </form>
        </>
      ) : null}
    </div>
  )
}
