import { CONTEST_HOST_EMBED_SELECT } from '../contestHosts'
import { contestClosed } from '../deadline'
import { displayNameStyleMapFromRpc, type DisplayNameStyleInfo } from '../displayNameStyle'
import { fetchGameTooltips, type GameTooltip } from '../gameTooltip'
import { getSupabase } from '../supabase'
import { parseTrackAnswer } from '../trackAnswer'
import type { ContestWithHosts, GradingMark, Submission, Track, TrackAnswer } from '../types'

export type ContestCoreBundle = {
  contest: ContestWithHosts | null
  tracks: Track[]
  contestMod: boolean
}

export async function fetchContestCoreBySlug(slug: string): Promise<ContestCoreBundle> {
  const supabase = getSupabase()

  const { data: contestRow, error: contestError } = await supabase
    .from('contests')
    .select(`*, ${CONTEST_HOST_EMBED_SELECT}`)
    .eq('slug', slug)
    .maybeSingle()

  if (contestError) throw contestError
  if (!contestRow) {
    return { contest: null, tracks: [], contestMod: false }
  }

  const contest = contestRow as ContestWithHosts
  const sessionPromise = supabase.auth.getSession()

  const [tracksResult, modResult] = await Promise.all([
    supabase
      .from('tracks')
      .select('*')
      .eq('contest_id', contest.id)
      .order('sort_order', { ascending: true }),
    sessionPromise.then(({ data: sessionData }) =>
      sessionData.session?.user
        ? supabase.rpc('is_contest_mod', { p_contest_id: contest.id }).then((r) => r.data)
        : Promise.resolve(null),
    ),
  ])

  const { data: trackRows, error: tracksError } = tracksResult
  if (tracksError) throw tracksError

  return {
    contest,
    tracks: (trackRows ?? []) as Track[],
    contestMod: Boolean(modResult),
  }
}

export type ContestRevealBundle = {
  answers: TrackAnswer[]
  submissions: Submission[]
  marks: GradingMark[]
  gameTooltips: Record<string, GameTooltip>
  displayNameByUserId: Map<string, string>
  profileUsernameByUserId: Map<string, string>
  displayNameStyleByUserId: Map<string, DisplayNameStyleInfo>
}

export async function fetchContestRevealBundle(
  contestId: string,
  trackIds: string[],
): Promise<ContestRevealBundle> {
  const supabase = getSupabase()

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

  const submissionList = (submissionsResult.data ?? []) as Submission[]
  const submissionIdSet = new Set(submissionList.map((s) => s.id))

  const [{ data: markRows }, { data: profilesBlob }] = await Promise.all([
    trackIds.length > 0
      ? supabase.from('grading_marks').select('*').in('track_id', trackIds)
      : Promise.resolve({ data: [] as GradingMark[] }),
    supabase.rpc('profiles_for_contest', { p_contest_id: contestId }),
  ])

  const marksForSubmissions =
    trackIds.length > 0
      ? ((markRows ?? []) as GradingMark[]).filter((mark) => submissionIdSet.has(mark.submission_id))
      : []

  const profilesJson = profilesBlob as {
    display_names?: Record<string, string>
    usernames?: Record<string, string>
    display_name_styles?: unknown
  } | null

  return {
    answers: answersList,
    submissions: submissionList,
    marks: marksForSubmissions,
    gameTooltips: tooltips,
    displayNameByUserId: new Map(Object.entries(profilesJson?.display_names ?? {})),
    profileUsernameByUserId: new Map(Object.entries(profilesJson?.usernames ?? {})),
    displayNameStyleByUserId: displayNameStyleMapFromRpc(profilesJson?.display_name_styles),
  }
}

export function shouldLoadContestReveal(
  deadline: string,
  resultsPublished: boolean,
  profileReady: boolean,
  isAdmin: boolean,
  contestMod: boolean,
): boolean {
  const deadlinePassed = contestClosed(deadline)
  return (deadlinePassed && resultsPublished) || (profileReady && isAdmin) || contestMod
}
