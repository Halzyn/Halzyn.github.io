import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getSupabase } from '../lib/supabase'
import type { ContestWithHosts, GradingMark, Submission, Track, TrackAnswer } from '../lib/types'
import { parseTrackAnswer } from '../lib/trackAnswer'
import { contestClosed } from '../lib/deadline'
import { Countdown } from '../components/Countdown'
import { ContestTrackAudio, type ContestTrackAudioHandle } from '../components/ContestTrackAudio'
import { ContestResults } from '../components/ContestResults'
import { DisplayNameStyled } from '../components/DisplayNameStyled'
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

function ContestArchiveBackLink() {
  return (
    <div className="profile-page-top">
      <p className="muted small profile-page-top-back">
        <Link to="/contests">← Contests</Link>
      </p>
    </div>
  )
}

export function ContestPage() {
  const supabase = getSupabase()
  const { ready, isAdmin } = useAuth()
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

  const previousSlugRef = useRef<string | undefined>(undefined)

  useDocumentTitle(documentTitle)

  useEffect(() => {
    if (!slug) {
      setDocumentTitle(pageTitle('Contest'))
      previousSlugRef.current = undefined
      return
    }

    const slugChanged = previousSlugRef.current !== slug
    previousSlugRef.current = slug

    async function loadContestPage() {
      if (slugChanged) {
        setContestRowReady(false)
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
      }

      setLoadError(null)

      const { data: contestRow, error: contestError } = await supabase
        .from('contests')
        .select(`*, ${CONTEST_HOST_EMBED_SELECT}`)
        .eq('slug', slug)
        .maybeSingle()

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
      setDocumentTitle(pageTitle(contestData.title))

      const { data: trackRows, error: tracksError } = await supabase
        .from('tracks')
        .select('*')
        .eq('contest_id', contestData.id)
        .order('sort_order', { ascending: true })

      if (tracksError) {
        setLoadError(tracksError.message)
        return
      }

      const trackList = (trackRows ?? []) as Track[]
      setTracks(trackList)

      const { data: sessionData } = await supabase.auth.getSession()
      let isContestMod = false
      if (sessionData.session?.user) {
        const { data: modResult } = await supabase.rpc('is_contest_mod', { p_contest_id: contestData.id })
        isContestMod = Boolean(modResult)
      }
      setContestMod(isContestMod)

      const deadlinePassed = contestClosed(contestData.deadline)
      const resultsPublished = Boolean(contestData.results_published)
      const loadRevealData =
        (deadlinePassed && resultsPublished) ||
        (ready && isAdmin) ||
        (deadlinePassed && isContestMod)

      const trackIds = trackList.map((t) => t.id)

      if (!loadRevealData) {
        setAnswers([])
        setSubmissions([])
        setMarks([])
        setGameTooltips({})
        setDisplayNameByUserId(new Map())
        setProfileUsernameByUserId(new Map())
        setDisplayNameStyleByUserId(new Map())
        return
      }

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
          .eq('contest_id', contestData.id)
          .order('created_at', { ascending: true }),
        fetchGameTooltips(supabase, trackIds),
      ])

      setAnswers(answersList)
      const submissionList = (submissionsResult.data ?? []) as Submission[]
      setSubmissions(submissionList)
      setGameTooltips(tooltips)

      const submissionIdSet = new Set(submissionList.map((s) => s.id))

      const [{ data: markRows }, { data: displayNamesJson }, { data: usernamesJson }, { data: stylesJson }] =
        await Promise.all([
          trackIds.length > 0
            ? supabase.from('grading_marks').select('*').in('track_id', trackIds)
            : Promise.resolve({ data: [] as GradingMark[] }),
          supabase.rpc('profile_display_names_for_contest', { p_contest_id: contestData.id }),
          supabase.rpc('profile_usernames_for_contest', { p_contest_id: contestData.id }),
          supabase.rpc('profile_display_name_styles_for_contest', { p_contest_id: contestData.id }),
        ])

      const marksForSubmissions =
        trackIds.length > 0
          ? ((markRows ?? []) as GradingMark[]).filter((mark) => submissionIdSet.has(mark.submission_id))
          : []
      setMarks(marksForSubmissions)

      setDisplayNameByUserId(new Map(Object.entries((displayNamesJson as Record<string, string>) ?? {})))
      setProfileUsernameByUserId(new Map(Object.entries((usernamesJson as Record<string, string>) ?? {})))
      setDisplayNameStyleByUserId(displayNameStyleMapFromRpc(stylesJson))
    }

    void loadContestPage()
  }, [slug, isAdmin, ready, supabase])

  const contestHosts = useMemo(
    () => (contest ? buildContestHostsFromEmbed(contest) : emptyContestHosts),
    [contest],
  )

  const deadlinePassed = contest ? contestClosed(contest.deadline) : false
  const resultsPublished = contest ? Boolean(contest.results_published) : false
  const showResultsToPublic = deadlinePassed && resultsPublished
  const showResults = (ready && isAdmin) || showResultsToPublic || contestMod
  const showAdminResultsPreview = ready && isAdmin && showResults && !showResultsToPublic
  const showModResultsPreview = contestMod && showResults && deadlinePassed && !resultsPublished
  const showResultsPreviewBanner = showAdminResultsPreview || showModResultsPreview

  const trackIds = useMemo(() => tracks.map((t) => t.id), [tracks])

  const leaderboard = useMemo(() => {
    if (!showResults || submissions.length === 0) return []
    return buildContestRankRows(submissions, trackIds, marks, tracks, displayNameByUserId)
  }, [showResults, submissions, marks, trackIds, tracks, displayNameByUserId])

  const tracksPlayerRef = useRef<ContestTrackAudioHandle>(null)
  const tracksFoldRef = useRef<HTMLDetailsElement>(null)
  const [tracksFoldOpen, setTracksFoldOpen] = useState(true)

  useLayoutEffect(() => {
    if (!contest) return
    setTracksFoldOpen(!contestClosed(contest.deadline))
  }, [contest])

  if (!slug) return null
  if (loadError) return <p className="banner warn">{loadError}</p>
  if (!contestRowReady) {
    return (
      <div className="page">
        <ContestArchiveBackLink />
        <p className="muted">Loading...</p>
      </div>
    )
  }
  if (contest === null) {
    return (
      <div className="page">
        <ContestArchiveBackLink />
        <p>Contest not found.</p>
        <Link to="/">Home</Link>
      </div>
    )
  }

  return (
    <div className="page">
      <ContestArchiveBackLink />
      <header className="page-head">
        <h1>{contest.title}</h1>
        {contestHosts.entries.length > 0 ? (
          <p className="muted small contest-hosts-line">
            {contestHosts.entries.map((host, index) => (
              <Fragment key={host.hostKey}>
                {index > 0 ? (
                  <span className="contest-title-with-hosts-sep" aria-hidden>
                    {' '}
                    ·{' '}
                  </span>
                ) : null}
                <DisplayNameStyled
                  text={host.displayName}
                  info={host.profileUserId ? contestHosts.styles.get(host.profileUserId) : undefined}
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
        {!deadlinePassed ? (
          <div>
            <p>
              <Link className="button" to={`/contests/${contest.slug}/submit`}>
                Submit answers
              </Link>
            </p>
          </div>
        ) : null}
      </header>

      <section className="section contest-tracks-section">
        <h2>
          Tracks
          {tracks.length > 0 ? (
            <span className="muted small contest-tracks-count"> ({tracks.length})</span>
          ) : null}
        </h2>
        <details
          ref={tracksFoldRef}
          className="spoiler tracks-fold"
          open={tracksFoldOpen}
          onToggle={(event) => setTracksFoldOpen(event.currentTarget.open)}
        >
          <summary className="tracks-fold-summary">Show tracks</summary>
          <div className="tracks-fold-body">
            {tracks.length === 0 ? (
              <p className="muted">Loading tracks...</p>
            ) : (
              <ContestTrackAudio ref={tracksPlayerRef} tracks={tracks} />
            )}
          </div>
        </details>
      </section>

      {showResultsPreviewBanner ? (
        <p className="banner" role="status">
          THE TABLE BELOW IS A PREVIEW, SO YOU DON'T HAVE TO WORRY!!
        </p>
      ) : null}
      {showResults ? (
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
          onPlayTrack={(trackId) => {
            setTracksFoldOpen(true)
            tracksPlayerRef.current?.playTrack(trackId)
            requestAnimationFrame(() => {
              tracksFoldRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            })
          }}
        />
      ) : null}
    </div>
  )
}
