import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ContestEntryForm } from '../components/ContestEntryForm'
import { getSupabase } from '../lib/supabase'
import type { ContestWithHosts, GradingMark, Submission, Track, TrackAnswer } from '../lib/types'
import { parseTrackAnswer } from '../lib/trackAnswer'
import { contestClosed } from '../lib/deadline'
import { Countdown } from '../components/Countdown'
import type { TrackAudioPlayerHandle } from '../components/TrackAudioPlayer'
import { ContestResults } from '../components/ContestResults'
import { ContestHostName } from '../components/ContestHostName'
import { pageTitle } from '../lib/pageTitle'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { fetchGameTooltips, type GameTooltip } from '../lib/gameTooltip'
import { buildContestRankRows } from '../lib/scoring'
import { displayNameStyleMapFromRpc, type DisplayNameStyleInfo } from '../lib/displayNameStyle'
import {
  buildContestHostsFromEmbed,
  CONTEST_HOST_EMBED_SELECT,
  emptyContestHosts,
} from '../lib/contestHosts'

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
  const supabase = getSupabase()
  const { ready, isAdmin, profile } = useAuth()
  const { slug } = useParams()

  const [contest, setContest] = useState<ContestWithHosts | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [answers, setAnswers] = useState<TrackAnswer[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [marks, setMarks] = useState<GradingMark[]>([])
  const [gameTooltips, setGameTooltips] = useState<Record<string, GameTooltip>>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [contestMod, setContestMod] = useState(false)
  const [displayNameByUserId, setDisplayNameByUserId] = useState<Map<string, string>>(new Map())
  const [profileUsernameByUserId, setProfileUsernameByUserId] = useState<Map<string, string>>(new Map())
  const [displayNameStyleByUserId, setDisplayNameStyleByUserId] = useState<Map<string, DisplayNameStyleInfo>>(
    new Map(),
  )
  const [documentTitle, setDocumentTitle] = useState(() => pageTitle('Contest'))
  const [contestRowReady, setContestRowReady] = useState(false)
  const [revealLoadedContestId, setRevealLoadedContestId] = useState<string | null>(null)

  const previousSlugRef = useRef<string | undefined>(undefined)
  const contestIdRef = useRef<string | null>(null)

  useDocumentTitle(documentTitle)

  useEffect(() => {
    if (!slug) {
      setDocumentTitle(pageTitle('Contest'))
      previousSlugRef.current = undefined
      contestIdRef.current = null
      return
    }

    const slugChanged = previousSlugRef.current !== slug
    previousSlugRef.current = slug

    let cancelled = false

    async function loadContestCore() {
      if (slugChanged) {
        setContestRowReady(false)
        setRevealLoadedContestId(null)
        setContest(null)
        setTracks([])
        setAnswers([])
        setSubmissions([])
        setMarks([])
        setGameTooltips({})
        setDisplayNameByUserId(new Map())
        setProfileUsernameByUserId(new Map())
        setDisplayNameStyleByUserId(new Map())
        setContestMod(false)
        contestIdRef.current = null
      }

      setLoadError(null)

      const { data: contestRow, error: contestError } = await supabase
        .from('contests')
        .select(`*, ${CONTEST_HOST_EMBED_SELECT}`)
        .eq('slug', slug)
        .maybeSingle()

      if (cancelled) return

      setContestRowReady(true)

      if (contestError) {
        setLoadError(contestError.message)
        setDocumentTitle(pageTitle('Contest'))
        setContest(null)
        return
      }

      if (!contestRow) {
        setContest(null)
        setDocumentTitle(pageTitle('Contest not found'))
        return
      }

      const contestData = contestRow as ContestWithHosts
      setContest(contestData)
      contestIdRef.current = contestData.id
      setDocumentTitle(pageTitle(contestData.title))

      const { data: trackRows, error: tracksError } = await supabase
        .from('tracks')
        .select('*')
        .eq('contest_id', contestData.id)
        .order('sort_order', { ascending: true })

      if (cancelled) return

      if (tracksError) {
        setLoadError(tracksError.message)
        return
      }

      setTracks((trackRows ?? []) as Track[])

      const { data: sessionData } = await supabase.auth.getSession()
      if (cancelled) return

      let isContestMod = false
      if (sessionData.session?.user) {
        const { data: modResult } = await supabase.rpc('is_contest_mod', { p_contest_id: contestData.id })
        isContestMod = Boolean(modResult)
      }
      if (!cancelled) setContestMod(isContestMod)
    }

    void loadContestCore()

    return () => {
      cancelled = true
    }
  }, [slug, supabase])

  useEffect(() => {
    const contestId = contest?.id ?? contestIdRef.current
    if (!contestId || tracks.length === 0) return

    let cancelled = false

    async function loadRevealData() {
      const deadlinePassed = contestClosed(contest!.deadline)
      const resultsPublished = Boolean(contest!.results_published)
      const loadRevealData =
        (deadlinePassed && resultsPublished) ||
        (ready && isAdmin) ||
        (ready && contestMod)

      const trackIds = tracks.map((t) => t.id)

      if (!loadRevealData) {
        setAnswers([])
        setSubmissions([])
        setMarks([])
        setGameTooltips({})
        setDisplayNameByUserId(new Map())
        setProfileUsernameByUserId(new Map())
        setDisplayNameStyleByUserId(new Map())
        setRevealLoadedContestId(null)
        return
      }

      setRevealLoadedContestId(null)

      const [answersList, submissionsResult, tooltips] = await Promise.all([
        trackIds.length > 0
          ? supabase
              .from('track_answers')
              .select('*')
              .in('track_id', trackIds)
              .then(({ data }) => (data ?? []).map(parseTrackAnswer))
          : Promise.resolve([] as TrackAnswer[]),
        supabase
          .from('submissions')
          .select('*')
          .eq('contest_id', contestId)
          .order('created_at', { ascending: true }),
        fetchGameTooltips(supabase, trackIds),
      ])

      if (cancelled) return

      setAnswers(answersList)
      const submissionList = (submissionsResult.data ?? []) as Submission[]
      setSubmissions(submissionList)
      setGameTooltips(tooltips)

      const submissionIdSet = new Set(submissionList.map((s) => s.id))

      const [{ data: markRows }, { data: profilesBlob }] = await Promise.all([
        trackIds.length > 0
          ? supabase.from('grading_marks').select('*').in('track_id', trackIds)
          : Promise.resolve({ data: [] as GradingMark[] }),
        supabase.rpc('profiles_for_contest', { p_contest_id: contestId }),
      ])

      if (cancelled) return

      const marksForSubmissions =
        trackIds.length > 0
          ? ((markRows ?? []) as GradingMark[]).filter((mark) => submissionIdSet.has(mark.submission_id))
          : []
      setMarks(marksForSubmissions)

      const profilesJson = profilesBlob as {
        display_names?: Record<string, string>
        usernames?: Record<string, string>
        display_name_styles?: unknown
      } | null
      setDisplayNameByUserId(new Map(Object.entries(profilesJson?.display_names ?? {})))
      setProfileUsernameByUserId(new Map(Object.entries(profilesJson?.usernames ?? {})))
      setDisplayNameStyleByUserId(displayNameStyleMapFromRpc(profilesJson?.display_name_styles))
      setRevealLoadedContestId(contestId)
    }

    void loadRevealData()

    return () => {
      cancelled = true
    }
  }, [contest, tracks, ready, isAdmin, contestMod, supabase])

  const contestHosts = useMemo(
    () => (contest ? buildContestHostsFromEmbed(contest) : emptyContestHosts),
    [contest],
  )

  const deadlinePassed = contest ? contestClosed(contest.deadline) : false
  const resultsPublished = contest ? Boolean(contest.results_published) : false
  const showResultsToPublic = deadlinePassed && resultsPublished
  const commentsOpen = showResultsToPublic
  const showResults = (ready && isAdmin) || showResultsToPublic || contestMod
  const canModerateComments = Boolean(contest && ((ready && isAdmin) || contestMod))
  const showAdminResultsPreview = ready && isAdmin && showResults && !showResultsToPublic
  const showModResultsPreview = contestMod && showResults && !showResultsToPublic
  const showResultsPreviewBanner = showAdminResultsPreview || showModResultsPreview
  const canEditContest = Boolean(contest && ((ready && isAdmin) || contestMod))
  const editContestHref = canEditContest ? `/admin/contests/${contest!.id}` : undefined
  const scoresReady = Boolean(contest && revealLoadedContestId === contest.id)

  const trackIds = useMemo(() => tracks.map((t) => t.id), [tracks])

  const leaderboard = useMemo(() => {
    if (!showResults || submissions.length === 0) return []
    return buildContestRankRows(submissions, trackIds, marks, tracks, displayNameByUserId)
  }, [showResults, submissions, marks, trackIds, tracks, displayNameByUserId])

  const alwaysRevealSpoilers = Boolean(profile?.always_reveal_spoilers)
  const entryFormRef = useRef<TrackAudioPlayerHandle>(null)
  const entrySectionRef = useRef<HTMLDivElement>(null)
  const showEntrySection = Boolean(contest && tracks.length > 0)

  if (!slug) return null
  if (loadError) return <p className="banner warn">{loadError}</p>
  if (!contestRowReady) {
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
        <p className="muted small">
          Deadline: {new Date(contest.deadline).toLocaleString()}
          {deadlinePassed ? ' (closed)' : null}
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
        ) : (
          <section className="section contest-results-section">
            <h2>Results</h2>
            <p className="muted">Loading...</p>
          </section>
        )
      ) : null}
    </div>
  )
}
