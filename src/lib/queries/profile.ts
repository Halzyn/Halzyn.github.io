import { parseDisplayNameStyleCaps, type DisplayNameStyleCaps } from '../displayNameStyle'
import { compareGameTitles } from '../gamesIndex'
import { getSupabase } from '../supabase'
import type { Game } from '../types'

export type MyContestSubmissionRow = {
  submission_id: string
  contest_id: string
  contest_slug: string
  contest_title: string
  deadline: string
  results_published: boolean
}

export async function fetchProfileNameStyleCaps(): Promise<DisplayNameStyleCaps> {
  const { data, error } = await getSupabase().rpc('profile_name_style_caps')
  if (error || data == null) return { canGradient: false, canEffect: false }
  return parseDisplayNameStyleCaps(data) ?? { canGradient: false, canEffect: false }
}

export async function fetchMyContestSubmissions(): Promise<MyContestSubmissionRow[]> {
  const { data, error } = await getSupabase().rpc('list_my_contest_submissions')
  if (error) throw error
  return Array.isArray(data) ? (data as MyContestSubmissionRow[]) : []
}

export async function fetchFavoriteSoundtrackGames(): Promise<Game[]> {
  const { data, error } = await getSupabase().rpc('list_games_for_favorite_soundtrack')
  if (error) throw error
  return ((data ?? []) as Game[]).slice().sort((a, b) => compareGameTitles(a.primary_title, b.primary_title))
}
