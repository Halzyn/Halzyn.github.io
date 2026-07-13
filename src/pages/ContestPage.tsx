import { Fragment, useMemo, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ContestEntryForm } from '../components/ContestEntryForm'
import { contestClosed } from '../lib/deadline'
import { ContestCalendarLink } from '../components/ContestCalendarLink'
import { Countdown } from '../components/Countdown'
import type { TrackAudioPlayerHandle } from '../components/TrackAudioPlayer'
import { ContestResults } from '../components/ContestResults'
import { ContestHostName } from '../components/ContestHostName'
import { contestPageMeta, contestsListMeta } from '../lib/siteMeta'
import { usePageMeta } from '../hooks/usePageMeta'
import { buildContestRankRows } from '../lib/scoring'
import { buildContestHostsFromEmbed, emptyContestHosts } from '../lib/contestHosts'
import { useContestCore, useContestReveal } from '../hooks/useContestPageQueries'

function ContestPageTop({ editContestHref }: { editContestHref?: string }) {
  return (
    <div className="profile-page-top">
      <p className="muted small profile-page-top-back">
        <Link to="/contests">← Contests</Link>
      </p>
      {editContestHref ? (
        <Link to={editContestHref} className="profile-page-edit-link">
          Edit contest
        </Link>
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
  const entryFormRef = useRef<TrackAudioPlayerHandle>(null)
  const entrySectionRef = useRef<HTMLDivElement>(null)
  const showEntrySection = Boolean(contest && tracks.length > 0)

  const loadError = coreError instanceof Error ? coreError.message : null

  if (!slug) return null
  if (loadError) return <p className="banner warn">{loadError}</p>
  if (corePending && !core) {
    return (
      <div className="page">
        <ContestPageTop />
        <p className="muted">Loading...</p>
      </div>
    )
  }
  if (contest === null) {
    return (
      <div className="page">
        <ContestPageTop />
        <p>Contest not found.</p>
        <Link to="/">Home</Link>
      </div>
    )
  }

  return (
    <div className="page">
      <ContestPageTop editContestHref={editContestHref} />
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
        <div ref={entrySectionRef}>
          <ContestEntryForm
            key={contest.id}
            ref={entryFormRef}
            contest={contest}
            tracks={tracks}
            slug={slug}
          />
        </div>
      ) : null}

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
            onPlayTrack={(trackId) => {
              entryFormRef.current?.playTrack(trackId)
              requestAnimationFrame(() => {
                entrySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
              })
            }}
          />
        ) : revealPending ? (
          <section className="section contest-results-section">
            <h2>Results</h2>
            <p className="muted">Loading...</p>
          </section>
        ) : null
      ) : null}
    </div>
  )
}
