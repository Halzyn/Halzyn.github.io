import { Fragment, useMemo, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../toast/ToastContext'
import { ContestEntryForm } from '../components/ContestEntryForm'
import { contestClosed } from '../lib/deadline'
import { ContestCalendarLink } from '../components/ContestCalendarLink'
import { Countdown } from '../components/Countdown'
import type { TrackAudioPlayerHandle } from '../components/TrackAudioPlayer'
import { ContestResults } from '../components/ContestResults'
import { ContestHostName } from '../components/ContestHostName'
import { LoadingState } from '../components/LoadingState'
import { contestPageMeta, contestsListMeta } from '../lib/siteMeta'
import { usePageMeta } from '../hooks/usePageMeta'
import { buildContestRankRows } from '../lib/scoring'
import { buildContestHostsFromEmbed, emptyContestHosts } from '../lib/contestHosts'
import { useContestCore, useContestReveal } from '../hooks/useContestPageQueries'

function EditIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={true}
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={true}
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51l6.83 3.98" />
      <path d="M15.41 6.51l-6.82 3.98" />
    </svg>
  )
}

function ContestPageTop({
  contestSlug,
  editContestHref,
}: {
  contestSlug?: string
  editContestHref?: string
}) {
  const { success: toastSuccess, toast } = useToast()

  async function handleShare() {
    if (!contestSlug) return
    const url = `${window.location.origin}/contests/${encodeURIComponent(contestSlug)}`
    try {
      await navigator.clipboard.writeText(url)
      toastSuccess('Contest link copied.')
    } catch {
      toast('Could not copy link.', { variant: 'warn' })
    }
  }

  const showActions = Boolean(contestSlug || editContestHref)

  return (
    <div className="profile-page-top">
      <p className="muted small profile-page-top-back">
        <Link to="/contests">← Contests</Link>
      </p>
      {showActions ? (
        <div className="profile-page-top-actions">
          {contestSlug ? (
            <button
              type="button"
              className="profile-page-icon-button"
              onClick={() => void handleShare()}
              aria-label="Copy contest link"
              title="Copy contest link"
            >
              <ShareIcon />
            </button>
          ) : null}
          {editContestHref ? (
            <Link
              to={editContestHref}
              className="profile-page-icon-button"
              aria-label="Edit contest"
              title="Edit contest"
            >
              <EditIcon />
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function ContestPage() {
  const { profileReady, isAdmin, profile } = useAuth()
  const { slug } = useParams()

  const { data: core, error: coreError, isPending: corePending } = useContestCore(slug)
  const contest = core?.contest ?? null
  const tracks = core?.tracks ?? []
  const contestMod = core?.contestMod ?? false
  const trackIds = useMemo(() => tracks.map((t) => t.id), [tracks])

  const resultsPublished = contest ? Boolean(contest.results_published) : false
  const {
    data: reveal,
    isPending: revealPending,
  } = useContestReveal(
    contest?.id,
    trackIds,
    contest?.deadline,
    resultsPublished,
    profileReady,
    isAdmin,
    contestMod,
  )

  const pageMeta = useMemo(() => {
    if (contest) return contestPageMeta({ contest, trackCount: tracks.length })
    if (!slug) return contestsListMeta()
    if (corePending && !core) return contestsListMeta()
    return contestsListMeta()
  }, [contest, tracks.length, slug, corePending, core])

  usePageMeta(pageMeta)

  const contestHosts = useMemo(
    () => (contest ? buildContestHostsFromEmbed(contest) : emptyContestHosts),
    [contest],
  )

  const deadlinePassed = contest ? contestClosed(contest.deadline) : false
  const showResultsToPublic = deadlinePassed && resultsPublished
  const commentsOpen = showResultsToPublic
  const showResults = (profileReady && isAdmin) || showResultsToPublic || contestMod
  const canModerateComments = Boolean(contest && ((profileReady && isAdmin) || contestMod))
  const showAdminResultsPreview = profileReady && isAdmin && showResults && !showResultsToPublic
  const showModResultsPreview = contestMod && showResults && !showResultsToPublic
  const showResultsPreviewBanner = showAdminResultsPreview || showModResultsPreview
  const canEditContest = Boolean(contest && ((profileReady && isAdmin) || contestMod))
  const editContestHref = canEditContest ? `/admin/contests/${contest!.id}` : undefined
  const scoresReady = Boolean(reveal)

  const answers = reveal?.answers ?? []
  const submissions = reveal?.submissions ?? []
  const marks = reveal?.marks ?? []
  const gameTooltips = reveal?.gameTooltips ?? {}
  const displayNameByUserId = reveal?.displayNameByUserId ?? new Map()
  const profileUsernameByUserId = reveal?.profileUsernameByUserId ?? new Map()
  const displayNameStyleByUserId = reveal?.displayNameStyleByUserId ?? new Map()

  const leaderboard = useMemo(() => {
    if (!showResults || submissions.length === 0) return []
    return buildContestRankRows(submissions, trackIds, marks, tracks, displayNameByUserId)
  }, [showResults, submissions, marks, trackIds, tracks, displayNameByUserId])

  const alwaysRevealSpoilers = Boolean(profile?.always_reveal_spoilers)
  const playerRef = useRef<TrackAudioPlayerHandle>(null)
  const showEntrySection = Boolean(contest && tracks.length > 0)
  const revealTrackDetails =
    resultsPublished || (profileReady && isAdmin) || contestMod

  const answersByTrackId = useMemo(() => {
    const map = new Map<string, (typeof answers)[number]>()
    for (const answer of answers) map.set(answer.track_id, answer)
    return map
  }, [answers])

  const loadError = coreError instanceof Error ? coreError.message : null

  if (!slug) return null
  if (loadError) return <p className="banner warn">{loadError}</p>
  if (corePending && !core) {
    return (
      <div className="page">
        <ContestPageTop contestSlug={slug} />
        <LoadingState label="Loading contest..." size="page" />
      </div>
    )
  }
  if (contest === null) {
    return (
      <div className="page">
        <ContestPageTop contestSlug={slug} />
        <p>Contest not found.</p>
        <Link to="/">Home</Link>
      </div>
    )
  }

  return (
    <div className="page">
      <ContestPageTop contestSlug={slug} editContestHref={editContestHref} />
      <header className="page-head">
        <h1>{contest.title}</h1>
        {contestHosts.entries.length > 0 ? (
          <p className="muted small contest-hosts-line">
            Hosted by {contestHosts.entries.map((host, index) => (
              <Fragment key={host.hostKey}>
                {index > 0 ? ', ' : null}
                <ContestHostName
                  displayName={host.displayName}
                  profileUsername={host.profileUsername}
                  styleInfo={host.profileUserId ? contestHosts.styles.get(host.profileUserId) : undefined}
                />
              </Fragment>
            ))}
          </p>
        ) : null}
        {contest.description ? <p className="lede lede--preline">{contest.description}</p> : null}
        {contest.scheduled_publish_at ? (
          <p className="muted small">
            Goes live {new Date(contest.scheduled_publish_at).toLocaleString()}
            {' ◦ '}
            <ContestCalendarLink
              contestId={contest.id}
              contestSlug={contest.slug}
              contestTitle={contest.title}
              scheduledPublishAtIso={contest.scheduled_publish_at}
              events={['go-live']}
            />
          </p>
        ) : null}
        <p className="muted small">
          Deadline: {new Date(contest.deadline).toLocaleString()}
          {deadlinePassed ? ' (closed)' : null}
          {!deadlinePassed ? (
            <>
              {' ◦ '}
              <ContestCalendarLink
                contestId={contest.id}
                contestSlug={contest.slug}
                contestTitle={contest.title}
                deadlineIso={contest.deadline}
                events={['deadline']}
              />
            </>
          ) : null}
        </p>
        {!deadlinePassed ? <Countdown deadlineIso={contest.deadline} /> : null}
      </header>

      {showEntrySection ? (
        <ContestEntryForm
          key={contest.id}
          ref={playerRef}
          contest={contest}
          tracks={tracks}
          slug={slug}
          stickyPlayerScope={showResults || showResultsPreviewBanner}
          revealTrackDetails={revealTrackDetails}
          answersByTrackId={answersByTrackId}
        >
          {showResultsPreviewBanner ? (
            <p className="banner" role="status">
              THE TABLE BELOW IS A PREVIEW, SO YOU DON'T HAVE TO WORRY!!
            </p>
          ) : null}
          {showResults ? (
            scoresReady ? (
              <ContestResults
                tracks={tracks}
                answers={answers}
                submissions={submissions}
                marks={marks}
                leaderboard={leaderboard}
                gameTooltips={gameTooltips}
                displayNameByUserId={displayNameByUserId}
                profileUsernameByUserId={profileUsernameByUserId}
                displayNameStyleByUserId={displayNameStyleByUserId}
                contestId={contest.id}
                commentsOpen={commentsOpen}
                canModerateComments={canModerateComments}
                alwaysRevealSpoilers={alwaysRevealSpoilers}
                onPlayTrack={(trackId) => playerRef.current?.playTrack(trackId)}
              />
            ) : revealPending ? (
              <section className="section contest-results-section">
                <h2>Results</h2>
                <LoadingState label="Loading results..." />
              </section>
            ) : null
          ) : null}
        </ContestEntryForm>
      ) : null}
    </div>
  )
}
