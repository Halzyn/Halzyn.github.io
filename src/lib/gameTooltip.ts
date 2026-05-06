import type { SupabaseClient } from '@supabase/supabase-js'

import { firstOf, uniqSorted } from './utils'

export type GameTooltip = {
  alternateTitles: string[]
  sharedMusicTitles: string[]
  primaryGameSlug?: string | null
}

type GameEmbed = {
  primary_title: string
  slug: string
  game_alternate_titles?: { title: string }[] | { title: string } | null
}

type TrackRow = {
  track_id: string
  link_kind: string
  games: GameEmbed | GameEmbed[] | null
}

function alternateTitleRows(game: GameEmbed): { title: string }[] {
  const raw = game.game_alternate_titles
  if (Array.isArray(raw)) return raw
  return raw ? [raw] : []
}

export async function fetchGameTooltips(
  supabase: SupabaseClient,
  trackIds: string[],
): Promise<Record<string, GameTooltip>> {
  const tooltips: Record<string, GameTooltip> = {}
  if (trackIds.length === 0) return tooltips

  const { data, error } = await supabase
    .from('track_game')
    .select(
      `
      track_id,
      link_kind,
      games (
        primary_title,
        slug,
        game_alternate_titles ( title )
      )
    `,
    )
    .in('track_id', trackIds)

  if (error) return tooltips

  for (const row of (data ?? []) as TrackRow[]) {
    const game = firstOf(row.games)
    if (!game) continue

    let tooltip = tooltips[row.track_id]
    if (!tooltip) tooltip = { alternateTitles: [], sharedMusicTitles: [] }

    if (row.link_kind === 'primary') {
      if (game.slug) tooltip.primaryGameSlug = game.slug
      tooltip.alternateTitles.push(...alternateTitleRows(game).map((x) => x.title))
    } else if (row.link_kind === 'shared_music') {
      tooltip.sharedMusicTitles.push(game.primary_title)
    }

    tooltips[row.track_id] = tooltip
  }

  for (const tooltip of Object.values(tooltips)) {
    tooltip.alternateTitles = uniqSorted(tooltip.alternateTitles)
    tooltip.sharedMusicTitles = uniqSorted(tooltip.sharedMusicTitles)
  }

  return tooltips
}
