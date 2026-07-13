import { CONTEST_HOST_EMBED_SELECT, hostsMapFromContests } from '../contestHosts'
import { getSupabase } from '../supabase'
import type { ContestWithHosts, ScheduledContestTeaser } from '../types'

export async function fetchContestsWithHosts(): Promise<ContestWithHosts[]> {
  const { data, error } = await getSupabase()
    .from('contests')
    .select(`*, ${CONTEST_HOST_EMBED_SELECT}`)
    .order('deadline', { ascending: false })
  if (error) throw error
  return (data ?? []) as ContestWithHosts[]
}

export function hostsByContestIdFromContests(contests: ContestWithHosts[]) {
  return hostsMapFromContests(contests)
}

export async function fetchScheduledContestTeasers(): Promise<ScheduledContestTeaser[]> {
  const { data, error } = await getSupabase().rpc('scheduled_contests_teaser')
  if (error) throw error
  return (data ?? []) as ScheduledContestTeaser[]
}

export async function fetchModeratedContestIds(userId: string): Promise<Set<string>> {
  const { data, error } = await getSupabase()
    .from('contest_moderators')
    .select('contest_id')
    .eq('user_id', userId)
  if (error) throw error
  return new Set((data ?? []).map((row) => row.contest_id as string))
}
