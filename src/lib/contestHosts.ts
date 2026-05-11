import type { SupabaseClient } from '@supabase/supabase-js'
import {
  displayNameStyleInfoFromProfileFields,
  type DisplayNameStyleInfo,
} from './displayNameStyle'
import { firstOf, pushToMappedList } from './utils'
import type { ContestGuestHostEmbed, ContestModeratorEmbed, ContestWithHosts } from './types'

function hostDisplayLabel(displayName: string | null | undefined, username: string | null | undefined): string {
  const d = displayName?.trim()
  if (d) return d
  const u = username?.trim()
  if (u) return u
  return 'Player'
}

export type ContestHostDisplayEntry = {
  hostKey: string
  profileUserId: string | null
  displayName: string
}

export type ContestHosts = {
  entries: ContestHostDisplayEntry[]
  styles: Map<string, DisplayNameStyleInfo>
}

export const emptyContestHosts: ContestHosts = { entries: [], styles: new Map() }

const MODERATOR_PROFILES_EMBED =
  'profiles(id, display_name, username, display_name_color, display_name_color_2, display_name_effect)'

export const CONTEST_HOST_EMBED_SELECT = `contest_moderators(user_id, ${MODERATOR_PROFILES_EMBED}), contest_guest_hosts(id, display_name, sort_order)`

const CONTEST_MODERATORS_STANDALONE_SELECT = `contest_id, user_id, ${MODERATOR_PROFILES_EMBED}`

function moderatorLabel(row: ContestModeratorEmbed): string {
  const profile = firstOf(row.profiles)
  return hostDisplayLabel(profile?.display_name, profile?.username)
}

export function buildContestHostsFromEmbed(contest: ContestWithHosts): ContestHosts {
  const styles = new Map<string, DisplayNameStyleInfo>()
  const modRows = [...(contest.contest_moderators ?? [])]
  const modDecorated = modRows.map((row) => {
    const profile = firstOf(row.profiles)
    const uid = row.user_id
    const label = moderatorLabel(row)
    const st = displayNameStyleInfoFromProfileFields(profile ?? undefined)
    if (st) styles.set(uid, st)
    return { row, label, lower: label.toLowerCase() }
  })
  modDecorated.sort((a, b) => a.lower.localeCompare(b.lower))

  const guestRows = [...(contest.contest_guest_hosts ?? [])].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.display_name.localeCompare(b.display_name, undefined, { sensitivity: 'base' })
  })

  const entries: ContestHostDisplayEntry[] = [
    ...modDecorated.map(({ row, label }) => ({
      hostKey: row.user_id,
      profileUserId: row.user_id,
      displayName: label,
    })),
    ...guestRows.map((g: ContestGuestHostEmbed) => ({
      hostKey: `guest:${g.id}`,
      profileUserId: null,
      displayName: g.display_name.trim() || 'Player',
    })),
  ]

  return { entries, styles }
}

export function hostsMapFromContests(contests: ContestWithHosts[]): Map<string, ContestHosts> {
  const m = new Map<string, ContestHosts>()
  for (const c of contests) {
    const h = buildContestHostsFromEmbed(c)
    if (h.entries.length > 0) m.set(c.id, h)
  }
  return m
}

type GuestFlatRow = ContestGuestHostEmbed & { contest_id: string }

export async function fetchHostsForContestIds(
  supabase: SupabaseClient,
  contestIds: string[],
): Promise<Map<string, ContestHosts>> {
  const map = new Map<string, ContestHosts>()
  const ids = [...new Set(contestIds)].filter(Boolean)
  if (ids.length === 0) return map

  const [modsRes, guestsRes] = await Promise.all([
    supabase.from('contest_moderators').select(CONTEST_MODERATORS_STANDALONE_SELECT).in('contest_id', ids),
    supabase.from('contest_guest_hosts').select('contest_id, id, display_name, sort_order').in('contest_id', ids),
  ])

  const modsByContest = new Map<string, ContestModeratorEmbed[]>()
  if (!modsRes.error) {
    for (const row of modsRes.data ?? []) {
      const r = row as { contest_id: string; user_id: string; profiles?: ContestModeratorEmbed['profiles'] }
      pushToMappedList(modsByContest, r.contest_id, { user_id: r.user_id, profiles: r.profiles })
    }
  }

  const guestsByContest = new Map<string, ContestGuestHostEmbed[]>()
  if (!guestsRes.error) {
    for (const row of guestsRes.data ?? []) {
      const r = row as GuestFlatRow
      pushToMappedList(guestsByContest, r.contest_id, {
        id: r.id,
        display_name: r.display_name,
        sort_order: r.sort_order,
      })
    }
  }

  for (const id of ids) {
    const h = buildContestHostsFromEmbed({
      id,
      contest_moderators: modsByContest.get(id) ?? null,
      contest_guest_hosts: guestsByContest.get(id) ?? null,
    } as ContestWithHosts)
    if (h.entries.length > 0) map.set(id, h)
  }
  return map
}
