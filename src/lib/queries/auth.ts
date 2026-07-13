import { fetchModeratedContests } from '../moderation'
import { getSupabase } from '../supabase'
import type { Profile } from '../types'

export async function fetchAuthProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await getSupabase().from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error || !data) return null
  return data as Profile
}

export async function fetchAuthModeratedContests(userId: string) {
  return fetchModeratedContests(getSupabase(), userId)
}
