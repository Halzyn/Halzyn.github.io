import { firstOf } from '../utils'
import { parseTrackAnswer } from '../trackAnswer'
import { getSupabase } from '../supabase'
import type { Contest, Game, Submission, Track, TrackAnswer } from '../types'

type TrackGameRow = {
  track_id: string
  link_kind: string
  games: { id: string; primary_title: string } | { id: string; primary_title: string }[] | null
}

type TrackGameInfos = { primaryGameId?: string; sharedMusicGameTitles: string[] }

function mergeAnswersFromTrackGameRows(
  answersByTrackId: Record<string, TrackAnswer>,
  trackIds: string[],
  trackGameRows: unknown[],
): void {
  if (!trackIds.length || !trackGameRows.length) return

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

export type AdminContestModerator = {
  user_id: string
  username: string | null
  display_name: string | null
}
export type AdminContestGuestHost = { id: string; display_name: string; sort_order: number }

export type AdminContestEditBundle = {
  contest: Contest
  tracks: Track[]
  submissions: Submission[]
  gamesCatalog: Game[]
  answers: Record<string, TrackAnswer>
  moderators: AdminContestModerator[]
  guestHosts: AdminContestGuestHost[]
}

export async function fetchAdminContestEditBundle(contestId: string): Promise<AdminContestEditBundle> {
  const supabase = getSupabase()

  const [contestResult, tracksResult, submissionsResult, gamesCatalogResult] = await Promise.all([
    supabase.from('contests').select('*').eq('id', contestId).single(),
    supabase
      .from('tracks')
      .select('*')
      .eq('contest_id', contestId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('submissions')
      .select('*')
      .eq('contest_id', contestId)
      .order('created_at', { ascending: true }),
    supabase
      .from('games')
      .select('id, primary_title, slug, created_at, updated_at')
      .order('primary_title', { ascending: true }),
  ])

  if (contestResult.error || !contestResult.data) {
    throw new Error(contestResult.error?.message ?? 'Not found')
  }
  if (tracksResult.error) throw tracksResult.error

  const contest = contestResult.data as Contest
  const tracks = (tracksResult.data ?? []) as Track[]
  const submissions = (submissionsResult.data ?? []) as Submission[]
  const gamesCatalog = (gamesCatalogResult.data ?? []) as Game[]

  const trackIds = tracks.map((track) => track.id)
  let rawAnswerRows: TrackAnswer[] = []
  let trackGameJoinRows: unknown[] = []
  if (trackIds.length) {
    const [answersResult, trackGameJoinResult] = await Promise.all([
      supabase.from('track_answers').select('*').in('track_id', trackIds),
      supabase
        .from('track_game')
        .select(
          `
          track_id,
          link_kind,
          games ( id, primary_title )
        `,
        )
        .in('track_id', trackIds),
    ])
    if (answersResult.error) throw answersResult.error
    rawAnswerRows = (answersResult.data ?? []) as TrackAnswer[]
    trackGameJoinRows = trackGameJoinResult.error ? [] : (trackGameJoinResult.data ?? [])
  }

  const answersByTrackId: Record<string, TrackAnswer> = {}
  for (const rawAnswer of rawAnswerRows) {
    const answer = parseTrackAnswer(rawAnswer)
    answersByTrackId[answer.track_id] = answer
  }
  mergeAnswersFromTrackGameRows(answersByTrackId, trackIds, trackGameJoinRows)

  const { data: moderatorRows } = await supabase
    .from('contest_moderators')
    .select('user_id')
    .eq('contest_id', contestId)
  const moderatorUserIds = (moderatorRows ?? []).map((row) => row.user_id as string)
  let moderators: AdminContestModerator[] = []
  if (moderatorUserIds.length > 0) {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .in('id', moderatorUserIds)
    moderators = ((profileRows ?? []) as {
      id: string
      username: string | null
      display_name: string | null
    }[]).map((profile) => ({
      user_id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
    }))
  }

  const { data: guestHostRows, error: guestHostError } = await supabase
    .from('contest_guest_hosts')
    .select('id, display_name, sort_order')
    .eq('contest_id', contestId)
    .order('sort_order', { ascending: true })

  const guestHosts = guestHostError
    ? []
    : ((guestHostRows ?? []) as AdminContestGuestHost[]).map((row) => ({ ...row }))

  return {
    contest,
    tracks,
    submissions,
    gamesCatalog,
    answers: answersByTrackId,
    moderators,
    guestHosts,
  }
}
