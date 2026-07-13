import { computePpRankByUserId } from '../performancePoints'
import type { ProfileContestStatsResult } from '../profileContestStats'
import type { ProfileRpgStats } from '../profileRpgStats'
import { displayNameStyleMapFromRpc, type DisplayNameStyleInfo } from '../displayNameStyle'
import { getSupabase } from '../supabase'
import type { PublicProfile } from '../types'

export async function fetchDisplayNameStylesForUsers(
  userIds: string[],
): Promise<Map<string, DisplayNameStyleInfo>> {
  if (userIds.length === 0) return new Map()
  const { data: styleBlob, error } = await getSupabase().rpc('profile_display_name_styles_for_users', {
    p_user_ids: userIds,
  })
  if (error) return new Map()
  return displayNameStyleMapFromRpc(styleBlob)
}

export type PlayersPublicBundle = {
  profiles: PublicProfile[]
  displayNameStyleByUserId: Map<string, DisplayNameStyleInfo>
}

export async function fetchPlayersPublicBundle(): Promise<PlayersPublicBundle> {
  const { data, error } = await getSupabase().rpc('list_players_public')
  if (error) throw error
  const profiles = (data ?? []) as PublicProfile[]
  const displayNameStyleByUserId = await fetchDisplayNameStylesForUsers(profiles.map((p) => p.id))
  return { profiles, displayNameStyleByUserId }
}

export type PublicProfileJson = {
  id: string
  username: string
  display_name: string
  bio: string | null
  player_number: number
  created_at: string
  avatar_path?: string | null
  is_admin?: boolean
  is_contest_moderator?: boolean
  favorite_soundtrack_cover_url?: string | null
  favorite_soundtrack_game_slug?: string | null
}

export type PublicProfileStats = {
  performance_points: number
  contest: ProfileContestStatsResult
  rpg: ProfileRpgStats
}

export type PublicProfilePageBundle = {
  profile: PublicProfileJson | null
  stats: PublicProfileStats | null
  displayNameStyleInfo: DisplayNameStyleInfo | null
  ppRank: number | null
}

export async function fetchPublicProfilePageBundle(username: string): Promise<PublicProfilePageBundle> {
  const [{ data, error }, { data: playersData, error: playersError }] = await Promise.all([
    getSupabase().rpc('get_public_profile_page_data', { p_username: username }),
    getSupabase().rpc('list_players_public'),
  ])

  if (error) throw error
  if (!data || typeof data !== 'object') {
    return { profile: null, stats: null, displayNameStyleInfo: null, ppRank: null }
  }

  const payload = data as { profile: PublicProfileJson; stats: PublicProfileStats }
  const pid = payload.profile.id
  const styleMap = await fetchDisplayNameStylesForUsers([pid])
  const ppRank =
    !playersError && playersData
      ? (computePpRankByUserId(playersData as PublicProfile[]).get(pid) ?? null)
      : null

  return {
    profile: payload.profile,
    stats: payload.stats,
    displayNameStyleInfo: styleMap.get(pid) ?? null,
    ppRank,
  }
}

export type SiteHostBundle = {
  displayName: string
  username: string | null
  nameStyle: DisplayNameStyleInfo | null
}

const SITE_HOST_PLAYER_NUMBER = 1

export async function fetchSiteHostBundle(): Promise<SiteHostBundle> {
  const fallback: SiteHostBundle = {
    displayName: 'Halzyn (hazel)',
    username: null,
    nameStyle: null,
  }
  const { data, error } = await getSupabase().rpc('list_players_public')
  if (error) return fallback
  const host = (data as PublicProfile[]).find((p) => p.player_number === SITE_HOST_PLAYER_NUMBER)
  if (!host) return fallback
  const styleMap = await fetchDisplayNameStylesForUsers([host.id])
  return {
    displayName: host.display_name,
    username: host.username,
    nameStyle: styleMap.get(host.id) ?? null,
  }
}
