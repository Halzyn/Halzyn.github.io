import {
  displayNameStyleInfoFromProfileFields,
  type DisplayNameStyleInfo,
} from './displayNameStyle'
import { firstOf } from './utils'
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

export const CONTEST_HOST_EMBED_SELECT =
  'contest_moderators(user_id, profiles(id, display_name, username, display_name_color, display_name_color_2, display_name_effect)), contest_guest_hosts(id, display_name, sort_order)'

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
