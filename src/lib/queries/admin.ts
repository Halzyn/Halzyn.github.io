import { parseTrackAnswer } from '../trackAnswer'
import { getSupabase } from '../supabase'
import type {
  Contest,
  Game,
  GameAlternateTitle,
  GradingMark,
  Profile,
  Submission,
  SubmissionGuess,
  Track,
  TrackAnswer,
} from '../types'

export async function fetchAdminContestsList(): Promise<Contest[]> {
  const { data, error } = await getSupabase()
    .from('contests')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Contest[]
}

export type AdminGradingBundle = {
  contest: Contest
  tracks: Track[]
  submissions: Submission[]
  guesses: SubmissionGuess[]
  marks: GradingMark[]
  answers: TrackAnswer[]
}

export async function fetchAdminGradingBundle(contestId: string): Promise<AdminGradingBundle> {
  const supabase = getSupabase()

  const [
    { data: contestRow, error: contestError },
    { data: trackRows },
    { data: submissionRows },
  ] = await Promise.all([
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
  ])

  if (contestError || !contestRow) {
    throw new Error(contestError?.message ?? 'Not found')
  }

  const trackList = (trackRows ?? []) as Track[]
  const submissionList = (submissionRows ?? []) as Submission[]
  const submissionIds = submissionList.map((s) => s.id)
  const trackIds = trackList.map((t) => t.id)

  const [guessesResult, marksResult, answersResult] = await Promise.all([
    submissionIds.length > 0
      ? supabase.from('submission_guesses').select('*').in('submission_id', submissionIds)
      : Promise.resolve({ data: [] as SubmissionGuess[] }),
    trackIds.length > 0
      ? supabase.from('grading_marks').select('*').in('track_id', trackIds)
      : Promise.resolve({ data: [] as GradingMark[] }),
    trackIds.length > 0
      ? supabase.from('track_answers').select('*').in('track_id', trackIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ])

  return {
    contest: contestRow as Contest,
    tracks: trackList,
    submissions: submissionList,
    guesses: (guessesResult.data ?? []) as SubmissionGuess[],
    marks: (marksResult.data ?? []) as GradingMark[],
    answers: (answersResult.data ?? []).map((row) => parseTrackAnswer(row)),
  }
}

export async function fetchAdminUsersList(): Promise<Profile[]> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('*')
    .order('player_number', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []) as Profile[]
}

export async function fetchAdminUserProfile(userId: string): Promise<Profile> {
  const { data, error } = await getSupabase().from('profiles').select('*').eq('id', userId).single()
  if (error || !data) throw new Error(error?.message ?? 'Not found')
  return data as Profile
}

export type AdminGameEditBundle = {
  game: Game
  alternates: GameAlternateTitle[]
  linkCount: number
}

export async function fetchAdminGameEditBundle(gameId: string): Promise<AdminGameEditBundle> {
  const supabase = getSupabase()
  const { data: row, error: loadError } = await supabase.from('games').select('*').eq('id', gameId).maybeSingle()
  if (loadError || !row) throw new Error(loadError?.message ?? 'Not found')

  const [{ data: alternateRows }, { count }] = await Promise.all([
    supabase
      .from('game_alternate_titles')
      .select('*')
      .eq('game_id', gameId)
      .order('title', { ascending: true }),
    supabase.from('track_game').select('*', { count: 'exact', head: true }).eq('game_id', gameId),
  ])

  return {
    game: row as Game,
    alternates: (alternateRows ?? []) as GameAlternateTitle[],
    linkCount: count ?? 0,
  }
}
