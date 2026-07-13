import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { TrackAudioPlayer, type TrackAudioPlayerHandle, type TrackPlaybackState } from './TrackAudioPlayer'
import { useContestEntry } from '../hooks/useContestEntry'
import { useContestEntryKeyboard } from '../hooks/useContestEntryKeyboard'
import { countAnsweredGuesses } from '../lib/contestEntry'
import type { Contest, Track } from '../lib/types'

function CopyEditLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button type="button" className="linkish small" onClick={() => void handleCopy()}>
      {copied ? 'Copied!' : 'Copy edit link'}
    </button>
  )
}

type ContestEntryFormProps = {
  contest: Contest
  tracks: Track[]
  slug: string
}

export const ContestEntryForm = forwardRef<TrackAudioPlayerHandle, ContestEntryFormProps>(
  function ContestEntryForm({ contest, tracks, slug }, ref) {
    const entry = useContestEntry({ contest, tracks, slug })
    const playerRef = useRef<TrackAudioPlayerHandle>(null)
    const guessInputRef = useRef<HTMLInputElement>(null)
    const [trackPlayback, setTrackPlayback] = useState<TrackPlaybackState>({
      activeId: null,
      isPlaying: false,
    })

    useImperativeHandle(
      ref,
      () => ({
        playTrack: (trackId) => playerRef.current?.playTrack(trackId),
        selectTrack: (trackId, options) => playerRef.current?.selectTrack(trackId, options),
        togglePlayPause: () => playerRef.current?.togglePlayPause(),
        goPrev: () => playerRef.current?.goPrev(),
        goNext: () => playerRef.current?.goNext(),
      }),
      [],
    )

    const answeredCount = useMemo(() => countAnsweredGuesses(entry.guesses), [entry.guesses])

    const activeTrackId = trackPlayback.activeId ?? tracks[0]?.id ?? null

    const activeTrack = useMemo(
      () => tracks.find((track) => track.id === activeTrackId) ?? null,
      [tracks, activeTrackId],
    )

    const selectTrack = useCallback((trackId: string, play = true) => {
      if (play) playerRef.current?.playTrack(trackId)
      else playerRef.current?.selectTrack(trackId, { play: false })
    }, [])

    const canFocusGuess =
      entry.showSubmissionFields && !entry.ownerClosedReadOnly && !entry.draftLoading

    useContestEntryKeyboard({
      enabled: entry.showPlaySection && tracks.length > 0,
      tracks,
      playerRef,
      guessInputRef,
      focusGuessOnTrackJump: canFocusGuess,
      onSelectTrack: (trackId) => selectTrack(trackId),
    })

    function renderTopBanner(): ReactNode {
      if (entry.showAdminChecking) {
        return <p className="muted">Checking sign in...</p>
      }
      if (entry.showAdminSignIn) {
        return <p className="banner warn">You do not have access to this submission.</p>
      }
      if (
        entry.draftLoading &&
        entry.closed &&
        entry.ready &&
        !entry.urlEditToken &&
        !entry.adminSubmissionId
      ) {
        return <p className="muted">Loading your entry...</p>
      }
      if (entry.showAdminDraftError) {
        return <p className="banner warn">{entry.pageError}</p>
      }
      return null
    }

    function renderIntroCopy(): ReactNode {
      if (entry.urlEditToken && !entry.adminSubmissionId) {
        return (
          <>
            Update your guesses below.
            {entry.canCopyEditLink ? (
              <>
                {' '}
                Use your private edit link to return from another device: <CopyEditLinkButton url={entry.editUrl} />.
              </>
            ) : null}
          </>
        )
      }
      if (entry.useAdminApi) {
        return <>You are editing this entrant&apos;s submission.</>
      }
      if (entry.sessionLocksName && entry.ready) {
        return (
          <>
            Play each track and enter your guesses. You can come back while the contest is open to update them.
          </>
        )
      }
      return (
        <>
          Play each track and enter your guesses. The first time you save, you will get a <strong>private edit link</strong>.
          This browser will remember your entry automatically.
        </>
      )
    }

    if (!entry.showPlaySection) {
      return <section className="section contest-entry-section">{renderTopBanner()}</section>
    }

    const sectionTitle = entry.showSubmissionFields ? 'Your entry' : 'Tracks'

    return (
      <section className="section contest-entry-section contest-entry">
        <h2>{sectionTitle}</h2>
        {renderTopBanner()}
        {entry.isAdmin && entry.adminSubmissionId ? (
          <p className="banner">Editing this submission in place.</p>
        ) : null}
        {entry.showSubmissionFields && !entry.ownerClosedReadOnly && entry.missingDisplayNameWhileSignedIn ? (
          <p className="banner warn">
            Add a display name under <Link to="/profile/edit">Edit profile</Link> before you can submit while signed in.
          </p>
        ) : null}
        {entry.showSubmissionFields && !entry.ownerClosedReadOnly ? (
          <p className="muted contest-entry-intro">
            {renderIntroCopy()}
            {' '}
            You can leave tracks blank. If you&apos;d rather send submissions directly, DM @halzyn on Discord.
            {entry.canCopyEditLink && !entry.urlEditToken ? (
              <>
                {' '}
                <CopyEditLinkButton url={entry.editUrl} />.
              </>
            ) : null}
          </p>
        ) : null}

        {entry.isDirty ? (
          <p className="banner warn small" role="status">
            You have unsaved changes.
          </p>
        ) : null}

        {entry.draftLoading && entry.showSubmissionFields ? (
          <p className="muted">Loading your saved entry...</p>
        ) : null}

        <form className="form contest-entry-form" onSubmit={entry.handleSubmit}>
          {activeTrack ? (
            <div className="contest-entry-focus">
              <div className="contest-entry-focus-head">
                <p className="contest-entry-focus-label">
                  Track {activeTrack.sort_order}
                  {activeTrack.difficulty ? (
                    <span className="muted"> ◦ {activeTrack.difficulty}</span>
                  ) : null}
                </p>
                {entry.showSubmissionFields ? (
                  <p className="muted small contest-entry-progress">
                    {answeredCount} / {tracks.length} answered
                  </p>
                ) : null}
              </div>

              {entry.showSubmissionFields ? (
                <label className="field contest-entry-guess-field">
                  <span>Your guess for track {activeTrack.sort_order}</span>
                  <input
                    ref={guessInputRef}
                    value={entry.guesses[activeTrack.id] ?? ''}
                    onChange={(e) =>
                      entry.setGuesses((previous) => ({ ...previous, [activeTrack.id]: e.target.value }))
                    }
                    maxLength={500}
                    placeholder="Game title / notes"
                    disabled={entry.draftLoading || entry.ownerClosedReadOnly}
                    className={entry.ownerClosedReadOnly ? 'submit-name-locked' : undefined}
                  />
                </label>
              ) : null}

              <nav className="contest-entry-track-grid" aria-label="Jump to track">
                {tracks.map((track) => {
                  const isActive = track.id === activeTrackId
                  const isAnswered = (entry.guesses[track.id] ?? '').trim().length > 0
                  const isPlaying = trackPlayback.activeId === track.id && trackPlayback.isPlaying
                  return (
                    <button
                      key={track.id}
                      type="button"
                      className={[
                        'contest-entry-track-pill',
                        isActive ? 'contest-entry-track-pill-active' : '',
                        entry.showSubmissionFields && isAnswered ? 'contest-entry-track-pill-answered' : '',
                        isPlaying ? 'contest-entry-track-pill-playing' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      aria-current={isActive ? 'true' : undefined}
                      aria-label={`Track ${track.sort_order}${isAnswered ? ', answered' : ''}`}
                      onClick={() => selectTrack(track.id)}
                    >
                      {track.sort_order}
                    </button>
                  )
                })}
              </nav>

              {tracks.length > 0 ? (
                <TrackAudioPlayer
                  ref={playerRef}
                  tracks={tracks}
                  onPlaybackChange={setTrackPlayback}
                  className="contest-entry-player"
                />
              ) : null}
            </div>
          ) : null}

          {entry.showSubmissionFields ? (
            <>
              {entry.pageError && !entry.showAdminDraftError ? (
                <p className="banner warn">{entry.pageError}</p>
              ) : null}
              <div className="actions contest-entry-save-row">
                {entry.ownerClosedReadOnly ? null : (
                  <>
                    <label className="contest-entry-name-field">
                      <span className="contest-entry-name-label">Your name</span>
                      <input
                        value={entry.name}
                        onChange={(e) => entry.setName(e.target.value)}
                        maxLength={80}
                        required={!entry.missingDisplayNameWhileSignedIn}
                        disabled={entry.nameInputDisabled}
                        className={entry.nameInputDisabled ? 'submit-name-locked' : undefined}
                        autoComplete="nickname"
                      />
                    </label>
                    {entry.showClaimSubmission ? (
                      <button
                        type="button"
                        className="button"
                        disabled={entry.claiming || entry.submitting}
                        onClick={() => void entry.handleClaimSubmission()}
                      >
                        {entry.claiming ? 'Linking...' : 'Claim submission'}
                      </button>
                    ) : null}
                    <button
                      type="submit"
                      className="button primary"
                      disabled={
                        entry.submitting ||
                        entry.draftLoading ||
                        (Boolean(entry.adminSubmissionId) && !entry.isAdmin) ||
                        entry.missingDisplayNameWhileSignedIn
                      }
                    >
                      {entry.submitting ? 'Saving...' : 'Save entry'}
                    </button>
                  </>
                )}
              </div>
            </>
          ) : null}
        </form>
      </section>
    )
  },
)
